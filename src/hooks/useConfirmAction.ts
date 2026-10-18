import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmController } from '../lib/confirmController';
import { ActionKind, Risk, confirmationRisk } from '../lib/dangerousActions';

const FALLBACK: Record<string, string> = {
  msg_laser: 'The laser will be armed and fire at the power set here. Make sure the area is clear and eye protection is in place.',
  msg_drill: 'The drill will spin. Make sure nothing can be caught by it.',
  msg_uv: 'The UV light will switch on. Keep eyes and skin away from the beam.',
  msg_weld: 'A welding pulse will be fired. Make sure the tip is where it should be and the area is clear.',
  msg_heater: 'A heater will be switched on at {{value}} C. It stays hot until you switch it off.',
  msg_motion: 'The tool will move. Make sure its path is clear.',
  msg_paste: 'Paste will be dispensed.',
  msg_feeder_reset: 'The feeder position will be reset to 0.',
  msg_program_config: 'This is written to the non-volatile memory of the board and stays after a restart.',
  msg_erase_fram: "The saved state of the board (its persisted tool setpoints) will be erased.",
  msg_raw_frame: 'This frame is sent to the board as typed.',
  msg_dev_key: 'This image is signed with the PUBLIC development key. That key proves nothing about who made the image: anyone can sign with it, and only boards whose bootloader was built with the same key accept it. Continue?',
  title_caution: 'Please confirm',
  title_danger: 'Dangerous action',
};

/**
 * Returns an async function that asks for confirmation when the action needs
 * it (see lib/dangerousActions.ts) and resolves true when the command may go
 * out. Rendered by <ConfirmDialog /> once, near the root of the app.
 */
export function useConfirmAction() {
  const { t } = useTranslation();
  return useCallback(async (kind: ActionKind, options: { value?: number; message?: string } = {}): Promise<boolean> => {
    const risk: Risk | null = confirmationRisk(kind, options.value);
    if (!risk) return true;
    const message = options.message ?? t(`confirm.msg_${kind}`, FALLBACK[`msg_${kind}`] ?? '', { value: options.value });
    return confirmController.ask({
      risk,
      title: t(`confirm.title_${risk}`, FALLBACK[`title_${risk}`]),
      message,
      confirmLabel: t('confirm.go_on', 'Continue'),
      cancelLabel: t('confirm.cancel', 'Cancel'),
    });
  }, [t]);
}
