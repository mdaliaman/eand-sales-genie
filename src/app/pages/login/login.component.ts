import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule, Loader2, Lock, Mail, ShieldCheck } from 'lucide-angular';
import { z } from 'zod';

import { AuthService } from '../../core/auth.service';
import { ButtonComponent } from '../../shared/button.component';

const schema = z.object({
  email: z.string().trim().email('Enter a valid work email').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, ButtonComponent],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly icons = { Loader2, Lock, Mail, ShieldCheck };

  email = '';
  password = '';
  error: string | null = null;
  busy = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  onSubmit(): void {
    const parsed = schema.safeParse({ email: this.email, password: this.password });
    if (!parsed.success) {
      this.error = parsed.error.issues[0]?.message ?? 'Invalid details';
      return;
    }
    this.error = null;
    this.busy = true;
    setTimeout(() => {
      this.auth.login(parsed.data.email);
      this.router.navigateByUrl('/dashboard');
    }, 500);
  }
}
