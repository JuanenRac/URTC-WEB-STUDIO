import { afterEach, describe, expect, it, vi } from 'vitest';

// The hook only uses useCallback and the translation function, so both are replaced by plain stand-ins and it can be called as a function.
vi.mock('react', () => ({ useCallback: <T,>(callback: T) => callback }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string, values?: { value?: number }) => (values?.value !== undefined ? fallback.replace('{{value}}', String(values.value)) : fallback) }),
}));

import { confirmController } from '../lib/confirmController';
import { useConfirmAction } from './useConfirmAction';

afterEach(() => confirmController.answer(false));

describe('the confirmation the commands go through', () => {
  it('lets a command through without asking when nothing needs to be confirmed', async () => {
    const confirm = useConfirmAction();
    expect(await confirm('heater', { value: 0 })).toBe(true);
    expect(await confirm('heater')).toBe(true);
    expect(confirmController.getSnapshot()).toBeNull();
  });

  it('asks for a dangerous action and resolves true only when the person goes on', async () => {
    const confirm = useConfirmAction();
    const answer = confirm('laser');
    const request = confirmController.getSnapshot();
    expect(request?.risk).toBe('danger');
    expect(request?.title).toBe('Dangerous action');
    expect(request?.message).toContain('laser');
    expect(request?.confirmLabel).toBe('Continue');
    expect(request?.cancelLabel).toBe('Cancel');
    confirmController.answer(true);
    expect(await answer).toBe(true);
  });

  it('resolves false when the person cancels', async () => {
    const confirm = useConfirmAction();
    const answer = confirm('drill');
    confirmController.answer(false);
    expect(await answer).toBe(false);
  });

  it('asks with the caution title for a heater that will be switched on and puts the setpoint in the message', async () => {
    const confirm = useConfirmAction();
    const answer = confirm('heater', { value: 215 });
    const request = confirmController.getSnapshot();
    expect(request?.risk).toBe('caution');
    expect(request?.title).toBe('Please confirm');
    expect(request?.message).toContain('215 C');
    confirmController.answer(true);
    await answer;
  });

  it('shows the message it is given instead of the standard one', async () => {
    const confirm = useConfirmAction();
    const answer = confirm('motion', { message: 'Move the table to the park position?' });
    expect(confirmController.getSnapshot()?.message).toBe('Move the table to the park position?');
    confirmController.answer(true);
    await answer;
  });

  it('asking again while one is open refuses the first one', async () => {
    const confirm = useConfirmAction();
    const first = confirm('weld');
    const second = confirm('uv');
    expect(await first).toBe(false);
    confirmController.answer(true);
    expect(await second).toBe(true);
  });
});
