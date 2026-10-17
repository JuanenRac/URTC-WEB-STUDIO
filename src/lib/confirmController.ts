import { Risk } from "./dangerousActions";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  risk: Risk;
}

export interface ConfirmRequest extends ConfirmOptions { id: number }

// One confirmation at a time. ask() resolves true only when the person chooses
// to go on; closing, pressing Escape, asking for another one while this one is
// open, or tearing the screen down all resolve false, so a dangerous command is
// never sent by default.
export class ConfirmController {
  private current: ConfirmRequest | null = null;
  private resolver: ((ok: boolean) => void) | null = null;
  private listeners = new Set<() => void>();
  private nextId = 1;

  ask(options: ConfirmOptions): Promise<boolean> {
    this.settle(false);
    this.current = { ...options, id: this.nextId++ };
    const promise = new Promise<boolean>((resolve) => { this.resolver = resolve; });
    this.emit();
    return promise;
  }

  answer(ok: boolean): void { this.settle(ok); }

  getSnapshot = (): ConfirmRequest | null => this.current;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private settle(ok: boolean): void {
    const resolver = this.resolver;
    if (!resolver) return;
    this.resolver = null;
    this.current = null;
    resolver(ok);
    this.emit();
  }

  private emit(): void { this.listeners.forEach(l => l()); }
}

export const confirmController = new ConfirmController();
