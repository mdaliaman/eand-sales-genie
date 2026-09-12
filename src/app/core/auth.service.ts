import { Injectable, signal } from '@angular/core';

export type User = { name: string; email: string };

const STORAGE_KEY = 'eand-sales-user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);

  constructor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.user.set(JSON.parse(raw) as User);
    } catch {
      /* ignore */
    }
    this.ready.set(true);
  }

  login(email: string): void {
    const name = (email.split('@')[0] ?? email)
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const next: User = { name, email };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.user.set(next);
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.user.set(null);
  }
}
