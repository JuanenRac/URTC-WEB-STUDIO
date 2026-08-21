import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FlasherState } from '../types';
import { SerialCanBus } from './useSerialCanBus';
import {
  CAN_ID_ENTER_BOOTLOADER, CAN_ID_START_UPDATE, CAN_ID_HMAC_CHUNK, CAN_ID_DATA,
  CAN_ID_PAGE_ACK, CAN_ID_END_UPDATE, CAN_ID_STATUS, CAN_ID_QUERY_VERSION,
  CAN_ID_VERSION_RESPONSE, CAN_ID_QUERY_ERROR_COUNTERS, CAN_ID_ERROR_COUNTERS_RESPONSE,
  CAN_ID_AUTHORIZE_DOWNGRADE, CAN_ID_READBACK, CAN_ID_READBACK_PAGE_ACK,
  CAN_ID_SLAVE_ENTER_BOOTLOADER, CAN_ID_SLAVE_START_UPDATE, CAN_ID_SLAVE_HMAC_CHUNK,
  CAN_ID_SLAVE_DATA, CAN_ID_SLAVE_END_UPDATE, CAN_ID_SLAVE_STATUS, CAN_ID_SLAVE_PROGRESS,
  CAN_ID_SLAVE_VERIFY_FAIL_REASON,
  ENTER_BOOTLOADER_MAGIC, AUTHORIZE_DOWNGRADE_MAGIC,
  THIS_HARDWARE_ID, SLAVE_HARDWARE_ID, FLASH_PAGE_SIZE, SLAVE_DATA_PACING_MS,
  APP_MAX_SIZE, SLAVE_APP_MAX_SIZE, SLAVE_HMAC_KEY,
  computeHmacSha256, packUInt32BE, packUInt16BE, unpackUInt32BE, getCrc32
} from '../lib/flasher';
import { CAN_ID_ERASE_FRAM, CAN_ID_FRAM_STATE_RESP, ERASE_FRAM_MAGIC, VERIFY_FAIL_REASONS } from '../lib/canIds';

export interface FlashOptions {
  triggerBootloader: boolean;
  eraseFram: boolean;
  allowDowngrade: boolean;
  reportMajor: number;
  reportMinor: number;
}

class FlashError extends Error {}

const initialState: FlasherState = {
  mode: 'idle',
  progress: 0,
  statusText: 'Idle',
  firmwareVersion: '1.1.0',
  targetHardwareId: THIS_HARDWARE_ID,
  selectedFile: '',
  hmacVerified: true,
  crcVerified: true,
  log: []
};

export function useFlasher(serialCan: SerialCanBus) {
  const { t } = useTranslation();
  const [flasherState, setFlasherState] = useState<FlasherState>(initialState);
  const [errorCounters, setErrorCounters] = useState<{ tec: number; rec: number } | null>(null);
  const stopRequestedRef = useRef(false);

  const appendLog = useCallback((line: string) => {
    setFlasherState(prev => ({ ...prev, log: [...prev.log, line] }));
  }, []);

  const checkCancelled = () => {
    if (stopRequestedRef.current) throw new FlashError('Cancelled by user');
  };

  // crypto.subtle (Web Crypto) only exists in a secure context (HTTPS or
  // localhost) - accessing this page over plain HTTP via a LAN IP address
  // leaves `crypto.subtle` undefined, which previously surfaced as a raw,
  // cryptic "Cannot read properties of undefined (reading 'importKey')"
  // buried in the flasher log. Checked upfront, before any real CAN traffic
  // for this attempt, with a clear, translated, actionable message instead.
  const checkSecureContext = () => {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new FlashError(t('flasher.err_insecure_context', 'Web Crypto (crypto.subtle) is unavailable, so HMAC signing cannot run - this page must be served over HTTPS or from localhost. Current origin: {{origin}}', { origin: typeof location !== 'undefined' ? location.origin : 'unknown' }));
    }
  };

  const cancel = useCallback(() => {
    stopRequestedRef.current = true;
  }, []);

  const queryErrorCounters = useCallback(async (): Promise<{ tec: number; rec: number } | null> => {
    if (!serialCan.isConnected) return null;
    await serialCan.sendFrame(CAN_ID_QUERY_ERROR_COUNTERS, [], 'Query CAN error counters (TEC/REC)');
    const resp = await serialCan.waitForFrame(CAN_ID_ERROR_COUNTERS_RESPONSE, 1500);
    if (!resp || resp.data.length < 2) {
      setErrorCounters(null);
      return null;
    }
    const counters = { tec: resp.data[0], rec: resp.data[1] };
    setErrorCounters(counters);
    return counters;
  }, [serialCan]);

  // ---- Main board CAN-OTA (0x7F0-0x7F7, 0x7FD) ----
  const flashMain = useCallback(async (data: Uint8Array, opts: FlashOptions) => {
    stopRequestedRef.current = false;
    checkSecureContext();
    if (data.length === 0) throw new FlashError(t('flasher.err_empty_file', 'Firmware file is empty'));
    if (data.length > APP_MAX_SIZE) throw new FlashError(t('flasher.err_exceeds_app_slot', 'Firmware exceeds the {{max}} byte application slot', { max: APP_MAX_SIZE }));

    const crc32 = getCrc32(data);
    const signature = await computeHmacSha256(data.buffer as ArrayBuffer);

    setFlasherState(prev => ({
      ...prev, mode: 'erasing', progress: 0,
      statusText: t('flasher.status_resetting_mcu', '1/5: Resetting MCU into CAN bootloader...'),
      log: [t('flasher.log_computing_crc', 'Computing CRC32 and HMAC-SHA256 over the selected image...')]
    }));

    if (opts.triggerBootloader) {
      await serialCan.sendFrame(CAN_ID_ENTER_BOOTLOADER, ENTER_BOOTLOADER_MAGIC, 'CAN OTA reset command (enter bootloader)');
      await new Promise(r => setTimeout(r, 800));

      if (opts.eraseFram) {
        await serialCan.sendFrame(CAN_ID_ERASE_FRAM, ERASE_FRAM_MAGIC, 'Erase F-RAM before flashing');
        const fram = await serialCan.waitForFrame(CAN_ID_FRAM_STATE_RESP, 2000);
        appendLog(fram ? t('flasher.log_fram_erase_confirmed', 'F-RAM erase confirmed.') : t('flasher.log_fram_erase_not_confirmed', 'F-RAM erase not confirmed within 2s (non-fatal, continuing).'));
      }
    }
    checkCancelled();

    const statusFrame = await serialCan.waitForFrame(CAN_ID_STATUS, 5000);
    if (!statusFrame || statusFrame.data[0] !== 0x01) {
      throw new FlashError(t('flasher.err_bootloader_not_responding', 'Bootloader not responding (no LISTENING status)'));
    }

    setFlasherState(prev => ({ ...prev, mode: 'receiving', progress: 5, log: [...prev.log, t('flasher.log_bootloader_listening', 'Bootloader listening. Sending START_UPDATE...')] }));
    checkCancelled();

    await serialCan.sendFrame(CAN_ID_START_UPDATE, [...packUInt32BE(data.length), ...packUInt32BE(THIS_HARDWARE_ID)], 'START_UPDATE (size + HardwareID)');
    const status2 = await serialCan.waitForFrame(CAN_ID_STATUS, 5000);
    if (!status2 || status2.data[0] !== 0x03) {
      throw new FlashError(t('flasher.err_bootloader_rejected', 'Bootloader rejected update start (expected RECEIVING status)'));
    }

    appendLog(t('flasher.log_hmac_sending', 'Sending HMAC-SHA256 signature (4 chunks)...'));
    for (let i = 0; i < 4; i++) {
      checkCancelled();
      await serialCan.sendFrame(CAN_ID_HMAC_CHUNK, Array.from(signature.slice(i * 8, (i + 1) * 8)), `HMAC chunk ${i + 1}/4`);
      await new Promise(r => setTimeout(r, 10));
    }

    if (opts.allowDowngrade) {
      await serialCan.sendFrame(CAN_ID_AUTHORIZE_DOWNGRADE, AUTHORIZE_DOWNGRADE_MAGIC, 'Authorize downgrade (bypass anti-rollback for this attempt)');
    }

    setFlasherState(prev => ({ ...prev, progress: 15, statusText: t('flasher.status_signature_accepted', '2/5: Signature accepted. Transferring pages...') }));

    let offset = 0;
    let pageIndex = 0;
    const totalPages = Math.ceil(data.length / FLASH_PAGE_SIZE);

    while (offset < data.length) {
      checkCancelled();
      const pageEnd = Math.min(offset + FLASH_PAGE_SIZE, data.length);
      const pageData = data.slice(offset, pageEnd);

      for (let i = 0; i < pageData.length; i += 8) {
        checkCancelled();
        // Built with a plain indexed loop rather than
        // Array.from(pageData.slice(...)) - a 112KB image walks this loop up
        // to ~14000 times, and slice()+Array.from() each allocate a whole
        // extra array per chunk for no benefit over reading bytes directly.
        const end = Math.min(i + 8, pageData.length);
        const chunk: number[] = [];
        for (let j = i; j < end; j++) chunk.push(pageData[j]);
        while (chunk.length < 8) chunk.push(0);
        await serialCan.sendFrame(CAN_ID_DATA, chunk, `Data page ${pageIndex}, offset ${offset + i}`);
        await new Promise(r => setTimeout(r, 2));
      }

      // Page-ACK: never resend page data on a lost ACK (only re-wait), since a
      // duplicate resend could desync the bootloader's own page counter.
      let ack = null;
      for (let attempt = 0; attempt < 3 && !ack; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt - 1)));
        ack = await serialCan.waitForFrame(CAN_ID_PAGE_ACK, 3000);
      }
      if (!ack || ack.data.length < 4) {
        throw new FlashError(t('flasher.err_page_ack_timeout', 'Timeout waiting for page-ACK on page {{page}}', { page: pageIndex }));
      }
      const ackedPage = unpackUInt32BE(ack.data);
      if (ackedPage !== pageIndex) {
        throw new FlashError(t('flasher.err_page_ack_mismatch', 'Page-ACK mismatch: expected page {{expected}}, board acked page {{actual}}', { expected: pageIndex, actual: ackedPage }));
      }

      offset = pageEnd;
      pageIndex++;
      setFlasherState(prev => ({ ...prev, progress: 15 + Math.floor((pageIndex / totalPages) * 70) }));
    }

    setFlasherState(prev => ({
      ...prev, mode: 'verifying', progress: 85,
      statusText: t('flasher.status_pages_written', '3/5: Pages written. Verifying backup slot...'),
      log: [...prev.log, t('flasher.log_all_pages_written', 'All pages written. Sending END_UPDATE.')]
    }));

    await serialCan.sendFrame(
      CAN_ID_END_UPDATE,
      [...packUInt32BE(crc32), ...packUInt16BE(opts.reportMajor), ...packUInt16BE(opts.reportMinor)],
      'END_UPDATE (CRC32 + declared version)'
    );

    setFlasherState(prev => ({ ...prev, mode: 'flashing', progress: 95, statusText: t('flasher.status_copying_backup', '4/5: Copying verified backup into main slot...') }));

    const deadline = Date.now() + 60000;
    let finalStatus: number | null = null;
    let failReason: number | undefined;
    while (Date.now() < deadline) {
      checkCancelled();
      const frame = await serialCan.waitForFrame(CAN_ID_STATUS, 1000);
      if (!frame) continue;
      if (frame.data[0] === 0x04) { finalStatus = 0x04; break; }
      if (frame.data[0] === 0x05) { finalStatus = 0x05; failReason = frame.data.length >= 2 ? frame.data[1] : undefined; break; }
      if (frame.data[0] === 0xFF) { finalStatus = 0xFF; break; }
      appendLog(t('flasher.log_board_status', 'Board status: 0x{{status}}', { status: frame.data[0].toString(16).padStart(2, '0') }));
    }

    if (finalStatus === 0x04) {
      setFlasherState(prev => ({
        ...prev, mode: 'idle', progress: 100,
        statusText: t('flasher.status_ota_complete', '5/5: OTA update complete! Booting v{{major}}.{{minor}}', { major: opts.reportMajor, minor: opts.reportMinor }),
        log: [...prev.log, t('flasher.log_update_success', 'Update SUCCESS.')]
      }));
      return;
    }
    if (finalStatus === 0x05) {
      const reasonText = failReason !== undefined ? (VERIFY_FAIL_REASONS[failReason] || `unknown (0x${failReason.toString(16)})`) : 'unknown';
      throw new FlashError(t('flasher.err_verification_failed', 'Update verification FAILED: {{reason}}', { reason: reasonText }));
    }
    if (finalStatus === 0xFF) {
      throw new FlashError(t('flasher.err_generic_bootloader', 'Bootloader reported a generic error'));
    }

    // No terminal status within the window - the reset transient can eat the
    // final confirmation frame even on a fully successful flash. Re-query.
    appendLog(t('flasher.log_requery', 'No terminal status received - re-querying version to check for a silent success...'));
    await serialCan.sendFrame(CAN_ID_QUERY_VERSION, [0x00], 'Re-query version after timeout');
    const versionResp = await serialCan.waitForFrame(CAN_ID_VERSION_RESPONSE, 2000);
    if (versionResp && versionResp.data[0] === 0x00) {
      setFlasherState(prev => ({ ...prev, mode: 'idle', progress: 100, statusText: t('flasher.status_likely_succeeded', 'Update likely succeeded (board answers as application).'), log: [...prev.log, t('flasher.log_recovered', 'Recovered from a lost confirmation frame.')] }));
      return;
    }
    throw new FlashError(t('flasher.err_incomplete_no_answer', 'Update did not complete within 60s and the board is not answering as application'));
  }, [serialCan, appendLog]);

  // ---- Expansion slave OTA, relayed through the main board's I2C bridge (0x210-0x219) ----
  const flashSlave = useCallback(async (data: Uint8Array, opts: { triggerBootloader: boolean; reportMajor: number; reportMinor: number }) => {
    stopRequestedRef.current = false;
    checkSecureContext();
    if (data.length === 0) throw new FlashError(t('flasher.err_empty_file', 'Firmware file is empty'));
    if (data.length > SLAVE_APP_MAX_SIZE) throw new FlashError(t('flasher.err_exceeds_slave_slot', 'Firmware exceeds the {{max}} byte slave application slot', { max: SLAVE_APP_MAX_SIZE }));

    const crc32 = getCrc32(data);
    // Slave board's own key, deliberately different from the master
    // board's default key computeHmacSha256 uses elsewhere in this file -
    // see slaveboot_common.h's own comment on why: signing a slave image
    // with the master's key would make its bootloader reject every real
    // update sent to it.
    const signature = await computeHmacSha256(data.buffer as ArrayBuffer, SLAVE_HMAC_KEY);

    setFlasherState(prev => ({ ...prev, mode: 'erasing', progress: 0, statusText: t('flasher.status_entering_slave_bootloader', '1/5: Entering slave bootloader (relayed via I2C)...'), log: [t('flasher.log_computing_crc', 'Computing CRC32 and HMAC-SHA256 over the selected image...')] }));

    if (opts.triggerBootloader) {
      await serialCan.sendFrame(CAN_ID_SLAVE_ENTER_BOOTLOADER, ENTER_BOOTLOADER_MAGIC, 'Slave: enter bootloader (relayed)');
      await new Promise(r => setTimeout(r, 800));
    }
    checkCancelled();

    await serialCan.sendFrame(CAN_ID_SLAVE_START_UPDATE, [...packUInt32BE(data.length), ...packUInt32BE(SLAVE_HARDWARE_ID)], 'Slave START_UPDATE (size + HardwareID)');

    const startDeadline = Date.now() + 5000;
    let receiving = false;
    while (Date.now() < startDeadline) {
      await serialCan.sendFrame(CAN_ID_SLAVE_STATUS, [], 'Slave: query status');
      const resp = await serialCan.waitForFrame(CAN_ID_SLAVE_STATUS, 300);
      if (resp && resp.data[0] === 0x03) { receiving = true; break; }
      if (resp && resp.data[0] === 0xFF) throw new FlashError(t('flasher.err_slave_rejected', 'Slave bootloader rejected update start'));
      await new Promise(r => setTimeout(r, 200));
    }
    if (!receiving) throw new FlashError(t('flasher.err_slave_timeout_receiving', 'Timeout waiting for slave bootloader to report RECEIVING'));

    appendLog(t('flasher.log_hmac_sending', 'Sending HMAC-SHA256 signature (4 chunks)...'));
    for (let i = 0; i < 4; i++) {
      checkCancelled();
      await serialCan.sendFrame(CAN_ID_SLAVE_HMAC_CHUNK, Array.from(signature.slice(i * 8, (i + 1) * 8)), `Slave HMAC chunk ${i + 1}/4`);
      await new Promise(r => setTimeout(r, 10));
    }

    setFlasherState(prev => ({ ...prev, progress: 15, statusText: t('flasher.status_slave_transferring', '2/5: Signature accepted. Transferring data (no page-ACK on this path)...') }));

    let offset = 0;
    let sinceLastPoll = 0;
    while (offset < data.length) {
      checkCancelled();
      // Same plain-loop construction as flashMain's page loop above, for the
      // same reason (avoids an extra slice()+Array.from() allocation per
      // 8-byte chunk over a potentially 54KB image).
      const end = Math.min(offset + 8, data.length);
      const chunk: number[] = [];
      for (let j = offset; j < end; j++) chunk.push(data[j]);
      while (chunk.length < 8) chunk.push(0);
      await serialCan.sendFrame(CAN_ID_SLAVE_DATA, chunk, `Slave data, offset ${offset}`);
      await new Promise(r => setTimeout(r, SLAVE_DATA_PACING_MS));
      offset += 8;
      sinceLastPoll += 8;
      if (sinceLastPoll >= FLASH_PAGE_SIZE || offset >= data.length) {
        sinceLastPoll = 0;
        setFlasherState(prev => ({ ...prev, progress: 15 + Math.floor((Math.min(offset, data.length) / data.length) * 70) }));
      }
    }

    setFlasherState(prev => ({ ...prev, mode: 'verifying', progress: 85, statusText: t('flasher.status_slave_verifying', '3/5: Transfer complete. Verifying...'), log: [...prev.log, t('flasher.log_slave_all_data_sent', 'All data sent. Sending END_UPDATE.')] }));

    await serialCan.sendFrame(CAN_ID_SLAVE_END_UPDATE, [...packUInt32BE(crc32), ...packUInt16BE(opts.reportMajor), ...packUInt16BE(opts.reportMinor)], 'Slave END_UPDATE (CRC32 + declared version)');

    setFlasherState(prev => ({ ...prev, mode: 'flashing', progress: 95, statusText: t('flasher.status_copying_backup', '4/5: Copying verified backup into main slot...') }));

    const endDeadline = Date.now() + 60000;
    let finalStatus: number | null = null;
    while (Date.now() < endDeadline) {
      checkCancelled();
      await serialCan.sendFrame(CAN_ID_SLAVE_STATUS, [], 'Slave: poll status');
      const resp = await serialCan.waitForFrame(CAN_ID_SLAVE_STATUS, 300);
      if (resp) {
        if (resp.data[0] === 0x04) { finalStatus = 0x04; break; }
        if (resp.data[0] === 0x05) { finalStatus = 0x05; break; }
        if (resp.data[0] === 0xFF) { finalStatus = 0xFF; break; }
      }
      await serialCan.sendFrame(CAN_ID_SLAVE_PROGRESS, [], 'Slave: poll progress');
      const prog = await serialCan.waitForFrame(CAN_ID_SLAVE_PROGRESS, 300);
      if (prog && prog.data[0] !== 0xFF) {
        setFlasherState(prev => ({ ...prev, progress: 70 + Math.floor(prog.data[0] * 0.3) }));
      }
      await new Promise(r => setTimeout(r, 300));
    }

    if (finalStatus === 0x04) {
      setFlasherState(prev => ({ ...prev, mode: 'idle', progress: 100, statusText: t('flasher.status_slave_complete', '5/5: Slave OTA update complete! v{{major}}.{{minor}}', { major: opts.reportMajor, minor: opts.reportMinor }), log: [...prev.log, t('flasher.log_slave_success', 'Slave update SUCCESS.')] }));
      return;
    }
    if (finalStatus === 0x05) {
      await serialCan.sendFrame(CAN_ID_SLAVE_VERIFY_FAIL_REASON, [], 'Slave: query verify-fail reason');
      const reasonFrame = await serialCan.waitForFrame(CAN_ID_SLAVE_VERIFY_FAIL_REASON, 1000);
      const reason = reasonFrame ? (VERIFY_FAIL_REASONS[reasonFrame.data[0]] || `unknown (0x${reasonFrame.data[0].toString(16)})`) : 'unknown';
      throw new FlashError(t('flasher.err_slave_verification_failed', 'Slave update verification FAILED: {{reason}}', { reason }));
    }
    if (finalStatus === 0xFF) throw new FlashError(t('flasher.err_slave_generic', 'Slave bootloader reported a generic error'));
    throw new FlashError(t('flasher.err_slave_incomplete', 'Slave update did not complete within 60s'));
  }, [serialCan, appendLog]);

  // ---- Backup / readback the main slot's current contents over CAN (0x7FE/0x7FF) ----
  const readBack = useCallback(async (onProgress?: (pct: number) => void): Promise<Uint8Array> => {
    stopRequestedRef.current = false;
    await serialCan.sendFrame(CAN_ID_READBACK, [], 'Start flash readback');
    const sizeFrame = await serialCan.waitForFrame(CAN_ID_READBACK, 5000);
    if (!sizeFrame || sizeFrame.dlc !== 4) throw new FlashError(t('flasher.err_readback_no_size', 'No readback size reply - bootloader may not implement 0x7FE, or nothing valid is installed'));
    const totalSize = unpackUInt32BE(sizeFrame.data);
    if (totalSize === 0) throw new FlashError(t('flasher.err_readback_no_firmware', 'Bootloader reports no valid firmware currently installed'));

    const buffer = new Uint8Array(totalSize);
    let received = 0;
    let pageIndex = 0;
    const overallDeadline = Date.now() + 180000;

    while (received < totalSize) {
      checkCancelled();
      if (Date.now() > overallDeadline) throw new FlashError(t('flasher.err_readback_timeout_overall', 'Readback timed out (180s overall limit)'));
      const chunk = await serialCan.waitForFrame(CAN_ID_READBACK, 5000);
      if (!chunk || chunk.dlc !== 8) throw new FlashError(t('flasher.err_readback_timeout_offset', 'Timeout waiting for readback data at offset {{offset}}', { offset: received }));
      const n = Math.min(8, totalSize - received);
      buffer.set(chunk.data.slice(0, n), received);
      received += n;
      onProgress?.(Math.floor((received / totalSize) * 100));

      const isPageBoundary = received % FLASH_PAGE_SIZE === 0;
      if (isPageBoundary || received >= totalSize) {
        await serialCan.sendFrame(CAN_ID_READBACK_PAGE_ACK, packUInt32BE(pageIndex), `Readback page-ACK ${pageIndex}`);
        pageIndex++;
      }
    }

    return buffer;
  }, [serialCan]);

  return { flasherState, setFlasherState, appendLog, cancel, queryErrorCounters, errorCounters, flashMain, flashSlave, readBack };
}
