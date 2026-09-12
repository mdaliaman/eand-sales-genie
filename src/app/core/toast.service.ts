import { Injectable, signal } from '@angular/core';

export type Toast = { id: number; type: 'success' | 'error'; message: string };

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  private show(type: Toast['type'], message: string): void {
    const id = Date.now() + Math.random();
    this.toasts.update((t) => [...t, { id, type, message }]);
    setTimeout(() => {
      this.toasts.update((t) => t.filter((x) => x.id !== id));
    }, 3500);
  }

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }
}
