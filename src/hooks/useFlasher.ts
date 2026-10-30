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
  APP_MAX_SIZE, SLAVE_APP_MAX_SIZE,
  packUInt32BE, unpackUInt32BE, getCrc32, isLastPartialPage, readbackChunkLength,
  minorField, formatVersion
} from '../lib/flasher';
import { dataChunkData, endUpdateData, hmacChunkData, startUpdateData } from '../lib/flashFrames';
import { queryMainVersion, querySlaveVersion, querySlaveApplicationVersion, BoardVersionInfo, SlaveVersionInfo, SlaveAppVersionInfo } from '../lib/boardVersion';
import { CAN_ID_ERASE_FRAM, CAN_ID_FRAM_STATE_RESP, ERASE_FRAM_MAGIC, VERIFY_FAIL_CODES } from '../lib/canIds';

export interface FlashOptions {
  triggerBootloader: boolean;
  eraseFram: boolean;
  allowDowngrade: boolean;
  reportMajor: number;
  reportMinor: number;
  reportPatch?: number; // declared only to a bootloader that announced the patch extension (CANBUS.TXT, FIRMWARE PATCH NUMBER)
  signature: Uint8Array; // HMAC-SHA256 published with the image - see lib/firmwareSignature.ts
}

class FlashError extends Error {}

const initialState: FlasherState = {
  mode: 'idle',
  progress: 0,
  statusText: 'Idle',
  firmwareVersion: '0.1.0',
  targetHardwareId: THIS_HARDWARE_ID,
  selectedFile: '',
  hmacVerified: true,
  crcVerified: true,
  log: []
};

export function useFlasher(serialCan: SerialCanBus) {
  const { t } = useTranslation();
  /** The bootloader's reason byte after a failed verification, in the language of the page. */
  const verifyFailText = (code: number | undefined): string => {
    if (code === undefined) return t('flasher.verify_fail_unknown', 'unknown reason');
    return VERIFY_FAIL_CODES.includes(code)
      ? t(`flasher.verify_fail_${code}`)
      : t('flasher.verify_fail_unknown_code', 'unknown reason 0x{{code}}', { code: code.toString(16) });
  };
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
    const resp = await serialCan.request(CAN_ID_QUERY_ERROR_COUNTERS, [], CAN_ID_ERROR_COUNTERS_RESPONSE, 1500, 'Query CAN error counters (TEC/REC)');
    if (!resp || resp.data.length < 2) {
      setErrorCounters(null);
      return null;
    }
    const counters = { tec: resp.data[0], rec: resp.data[1] };
    setErrorCounters(counters);
    return counters;
  }, [serialCan]);

  // ---- Version queries: 0x7F8 -> 0x7F9/0x7FA/0x7E9 (main board), 0x217 -> 0x217/0x218 (expansion slave) ----
  const queryVersion = useCallback(async (): Promise<BoardVersionInfo | null> => {
    if (!serialCan.isConnected) return null;
    return queryMainVersion(serialCan);
  }, [serialCan]);

  const queryExpansionVersion = useCallback(async (): Promise<SlaveVersionInfo | null> => {
    if (!serialCan.isConnected) return null;
    return querySlaveVersion(serialCan);
  }, [serialCan]);

  // The application of the expansion slave, read through the master: 0x221 for register 0x01 and its 0x222 companion.
  const queryExpansionApplication = useCallback(async (): Promise<SlaveAppVersionInfo | null> => {
    if (!serialCan.isConnected) return null;
    return querySlaveApplicationVersion(serialCan);
  }, [serialCan]);

  // The patch goes to END_UPDATE only towards a bootloader that announced it in its own answer, asked once it is listening.
  const bootloaderAcceptsPatch = async (patch: number | undefined, query: () => Promise<{ acceptsPatchInEndUpdate: boolean } | null>, version: string): Promise<boolean> => {
    if (patch === undefined) return false;
    let accepts = false;
    try {
      accepts = !!(await query())?.acceptsPatchInEndUpdate;
    } catch {
      accepts = false;
    }
    appendLog(accepts
      ? t('flasher.log_patch_declared', 'The bootloader accepts the patch number: declaring version {{version}}.', { version })
      : t('flasher.log_patch_not_declared', 'The bootloader does not announce patch support: declaring the version without the patch.'));
    return accepts;
  };

  // ---- Main board CAN-OTA (0x7F0-0x7F7, 0x7FD) ----
  const flashMain = useCallback(async (data: Uint8Array, opts: FlashOptions) => {
    stopRequestedRef.current = false;
    checkSecureContext();
    if (data.length === 0) throw new FlashError(t('flasher.err_empty_file', 'Firmware file is empty'));
    if (data.length > APP_MAX_SIZE) throw new FlashError(t('flasher.err_exceeds_app_slot', 'Firmware exceeds the {{max}} byte application slot', { max: APP_MAX_SIZE }));

    const crc32 = getCrc32(data);
    const signature = opts.signature;
    if (signature.length !== 32) throw new FlashError('HMAC-SHA256 signature must be 32 bytes');

    setFlasherState(prev => ({
      ...prev, mode: 'erasing', progress: 0,
      statusText: t('flasher.status_resetting_mcu', '1/5: Resetting MCU into CAN bootloader...'),
      log: [t('flasher.log_computing_crc', 'Computing CRC32 and HMAC-SHA256 over the selected image...')]
    }));

    if (opts.triggerBootloader) {
      // F-RAM is erased by the running application: the bootloader does not know that command, so it goes first.
      if (opts.eraseFram) {
        const fram = await serialCan.request(CAN_ID_ERASE_FRAM, ERASE_FRAM_MAGIC, CAN_ID_FRAM_STATE_RESP, 2000, 'Erase F-RAM before flashing');
        appendLog(fram ? t('flasher.log_fram_erase_confirmed', 'F-RAM erase confirmed.') : t('flasher.log_fram_erase_not_confirmed', 'F-RAM erase not confirmed within 2s (non-fatal, continuing).'));
      }
      // A status left over from an earlier attempt must not be taken for the bootloader that is about to start.
      serialCan.flushFrames(CAN_ID_STATUS);
      await serialCan.sendFrame(CAN_ID_ENTER_BOOTLOADER, ENTER_BOOTLOADER_MAGIC, 'CAN OTA reset command (enter bootloader)');
      await new Promise(r => setTimeout(r, 800));
    }
    checkCancelled();

    const statusFrame = await serialCan.waitForFrame(CAN_ID_STATUS, 5000);
    if (!statusFrame || statusFrame.data[0] !== 0x01) {
      throw new FlashError(t('flasher.err_bootloader_not_responding', 'Bootloader not responding (no LISTENING status)'));
    }

    setFlasherState(prev => ({ ...prev, mode: 'receiving', progress: 5, log: [...prev.log, t('flasher.log_bootloader_listening', 'Bootloader listening. Sending START_UPDATE...')] }));
    checkCancelled();

    const sendPatch = await bootloaderAcceptsPatch(
      opts.reportPatch,
      async () => { const info = await queryMainVersion(serialCan); return info?.responder === 'bootloader' ? info : null; },
      formatVersion({ major: opts.reportMajor, minor: opts.reportMinor, patch: opts.reportPatch })
    );
    checkCancelled();

    serialCan.flushFrames(CAN_ID_STATUS); // only statuses sent after START_UPDATE count
    await serialCan.sendFrame(CAN_ID_START_UPDATE, startUpdateData(data.length, THIS_HARDWARE_ID), 'START_UPDATE (size + HardwareID)');
    // ERASING (0x02) arrives first and RECEIVING (0x03) when the erase is done (up to a couple of seconds later): the first is not a refusal, only 0x03 starts the transfer.
    let receiving = false;
    const startDeadline = Date.now() + 5000;
    while (Date.now() < startDeadline) {
      const status2 = await serialCan.waitForFrame(CAN_ID_STATUS, Math.max(100, startDeadline - Date.now()));
      if (!status2) break;
      if (status2.data[0] === 0x03) { receiving = true; break; }
      if (status2.data[0] === 0x05 || status2.data[0] === 0xFF) break;
    }
    if (!receiving) {
      throw new FlashError(t('flasher.err_bootloader_rejected', 'Bootloader rejected update start (expected RECEIVING status)'));
    }

    appendLog(t('flasher.log_hmac_sending', 'Sending HMAC-SHA256 signature (4 chunks)...'));
    for (let i = 0; i < 4; i++) {
      checkCancelled();
      await serialCan.sendFrame(CAN_ID_HMAC_CHUNK, hmacChunkData(signature, i), `HMAC chunk ${i + 1}/4`);
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
        const chunk = dataChunkData(pageData, i);
        // the last frame of the image keeps its real length (DLC): padding it made the board count bytes that are not in the image
        await serialCan.sendFrame(CAN_ID_DATA, chunk, `Data page ${pageIndex}, offset ${offset + i}`);
        await new Promise(r => setTimeout(r, 2));
      }

      // Page-ACK: never resend page data on a lost ACK (only re-wait), since a
      // duplicate resend could desync the bootloader's own page counter.
      // The last, partial page is acknowledged by the board only when END_UPDATE arrives, so it is not waited for here (it is read after END_UPDATE).
      if (!isLastPartialPage(data.length, pageEnd, FLASH_PAGE_SIZE)) {
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
      endUpdateData(crc32, opts.reportMajor, minorField(opts.reportMinor, opts.reportPatch, sendPatch)),
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
        statusText: t('flasher.status_ota_complete', '5/5: OTA update complete! Booting v{{version}}', { version: formatVersion({ major: opts.reportMajor, minor: opts.reportMinor, patch: sendPatch ? opts.reportPatch : undefined }) }),
        log: [...prev.log, t('flasher.log_update_success', 'Update SUCCESS.')]
      }));
      return;
    }
    if (finalStatus === 0x05) {
      const reasonText = verifyFailText(failReason);
      throw new FlashError(t('flasher.err_verification_failed', 'Update verification FAILED: {{reason}}', { reason: reasonText }));
    }
    if (finalStatus === 0xFF) {
      throw new FlashError(t('flasher.err_generic_bootloader', 'Bootloader reported a generic error'));
    }

    // No terminal status within the window - the reset transient can eat the
    // final confirmation frame even on a fully successful flash. Re-query.
    appendLog(t('flasher.log_requery', 'No terminal status received - re-querying version to check for a silent success...'));
    const versionResp = await serialCan.request(CAN_ID_QUERY_VERSION, [0x00], CAN_ID_VERSION_RESPONSE, 2000, 'Re-query version after timeout');
    if (versionResp && versionResp.data[0] === 0x00) {
      setFlasherState(prev => ({ ...prev, mode: 'idle', progress: 100, statusText: t('flasher.status_likely_succeeded', 'Update likely succeeded (board answers as application).'), log: [...prev.log, t('flasher.log_recovered', 'Recovered from a lost confirmation frame.')] }));
      return;
    }
    throw new FlashError(t('flasher.err_incomplete_no_answer', 'Update did not complete within 60s and the board is not answering as application'));
  }, [serialCan, appendLog]);

  // ---- Expansion slave OTA, relayed through the main board's I2C bridge (0x210-0x219) ----
  const flashSlave = useCallback(async (data: Uint8Array, opts: { triggerBootloader: boolean; reportMajor: number; reportMinor: number; reportPatch?: number; signature: Uint8Array }) => {
    stopRequestedRef.current = false;
    checkSecureContext();
    if (data.length === 0) throw new FlashError(t('flasher.err_empty_file', 'Firmware file is empty'));
    if (data.length > SLAVE_APP_MAX_SIZE) throw new FlashError(t('flasher.err_exceeds_slave_slot', 'Firmware exceeds the {{max}} byte slave application slot', { max: SLAVE_APP_MAX_SIZE }));

    const crc32 = getCrc32(data);
    // Signed by the URTC build with the slave board's own key (different
    // from the master's - see slaveboot_common.h); published with the image.
    const signature = opts.signature;
    if (signature.length !== 32) throw new FlashError('HMAC-SHA256 signature must be 32 bytes');

    setFlasherState(prev => ({ ...prev, mode: 'erasing', progress: 0, statusText: t('flasher.status_entering_slave_bootloader', '1/5: Entering slave bootloader (relayed via I2C)...'), log: [t('flasher.log_computing_crc', 'Computing CRC32 and HMAC-SHA256 over the selected image...')] }));

    if (opts.triggerBootloader) {
      await serialCan.sendFrame(CAN_ID_SLAVE_ENTER_BOOTLOADER, ENTER_BOOTLOADER_MAGIC, 'Slave: enter bootloader (relayed)');
      await new Promise(r => setTimeout(r, 800));
    }
    checkCancelled();

    const sendPatch = await bootloaderAcceptsPatch(
      opts.reportPatch,
      () => querySlaveVersion(serialCan),
      formatVersion({ major: opts.reportMajor, minor: opts.reportMinor, patch: opts.reportPatch })
    );
    checkCancelled();

    await serialCan.sendFrame(CAN_ID_SLAVE_START_UPDATE, startUpdateData(data.length, SLAVE_HARDWARE_ID), 'Slave START_UPDATE (size + HardwareID)');

    const startDeadline = Date.now() + 5000;
    let receiving = false;
    while (Date.now() < startDeadline) {
      const resp = await serialCan.request(CAN_ID_SLAVE_STATUS, [], CAN_ID_SLAVE_STATUS, 300, 'Slave: query status');
      if (resp && resp.data[0] === 0x03) { receiving = true; break; }
      if (resp && resp.data[0] === 0xFF) throw new FlashError(t('flasher.err_slave_rejected', 'Slave bootloader rejected update start'));
      await new Promise(r => setTimeout(r, 200));
    }
    if (!receiving) throw new FlashError(t('flasher.err_slave_timeout_receiving', 'Timeout waiting for slave bootloader to report RECEIVING'));

    appendLog(t('flasher.log_hmac_sending', 'Sending HMAC-SHA256 signature (4 chunks)...'));
    for (let i = 0; i < 4; i++) {
      checkCancelled();
      await serialCan.sendFrame(CAN_ID_SLAVE_HMAC_CHUNK, hmacChunkData(signature, i), `Slave HMAC chunk ${i + 1}/4`);
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

    await serialCan.sendFrame(CAN_ID_SLAVE_END_UPDATE, endUpdateData(crc32, opts.reportMajor, minorField(opts.reportMinor, opts.reportPatch, sendPatch)), 'Slave END_UPDATE (CRC32 + declared version)');

    setFlasherState(prev => ({ ...prev, mode: 'flashing', progress: 95, statusText: t('flasher.status_copying_backup', '4/5: Copying verified backup into main slot...') }));

    const endDeadline = Date.now() + 60000;
    let finalStatus: number | null = null;
    while (Date.now() < endDeadline) {
      checkCancelled();
      const resp = await serialCan.request(CAN_ID_SLAVE_STATUS, [], CAN_ID_SLAVE_STATUS, 300, 'Slave: poll status');
      if (resp) {
        if (resp.data[0] === 0x04) { finalStatus = 0x04; break; }
        if (resp.data[0] === 0x05) { finalStatus = 0x05; break; }
        if (resp.data[0] === 0xFF) { finalStatus = 0xFF; break; }
      }
      const prog = await serialCan.request(CAN_ID_SLAVE_PROGRESS, [], CAN_ID_SLAVE_PROGRESS, 300, 'Slave: poll progress');
      if (prog && prog.data[0] !== 0xFF) {
        setFlasherState(prev => ({ ...prev, progress: 70 + Math.floor(prog.data[0] * 0.3) }));
      }
      await new Promise(r => setTimeout(r, 300));
    }

    if (finalStatus === 0x04) {
      setFlasherState(prev => ({ ...prev, mode: 'idle', progress: 100, statusText: t('flasher.status_slave_complete', '5/5: Slave OTA update complete! v{{version}}', { version: formatVersion({ major: opts.reportMajor, minor: opts.reportMinor, patch: sendPatch ? opts.reportPatch : undefined }) }), log: [...prev.log, t('flasher.log_slave_success', 'Slave update SUCCESS.')] }));
      return;
    }
    if (finalStatus === 0x05) {
      const reasonFrame = await serialCan.request(CAN_ID_SLAVE_VERIFY_FAIL_REASON, [], CAN_ID_SLAVE_VERIFY_FAIL_REASON, 1000, 'Slave: query verify-fail reason');
      const reason = verifyFailText(reasonFrame ? reasonFrame.data[0] : undefined);
      throw new FlashError(t('flasher.err_slave_verification_failed', 'Slave update verification FAILED: {{reason}}', { reason }));
    }
    if (finalStatus === 0xFF) throw new FlashError(t('flasher.err_slave_generic', 'Slave bootloader reported a generic error'));
    throw new FlashError(t('flasher.err_slave_incomplete', 'Slave update did not complete within 60s'));
  }, [serialCan, appendLog]);

  // ---- Backup / readback the main slot's current contents over CAN (0x7FE/0x7FF) ----
  const readBack = useCallback(async (onProgress?: (pct: number) => void): Promise<Uint8Array> => {
    stopRequestedRef.current = false;
    const sizeFrame = await serialCan.request(CAN_ID_READBACK, [], CAN_ID_READBACK, 5000, 'Start flash readback');
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
      const n = chunk ? readbackChunkLength(chunk.dlc, totalSize - received) : 0;
      if (!chunk || n === 0) throw new FlashError(t('flasher.err_readback_timeout_offset', 'Timeout waiting for readback data at offset {{offset}}', { offset: received }));
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

  return { flasherState, setFlasherState, appendLog, cancel, queryVersion, queryExpansionVersion, queryExpansionApplication, queryErrorCounters, errorCounters, flashMain, flashSlave, readBack };
}
