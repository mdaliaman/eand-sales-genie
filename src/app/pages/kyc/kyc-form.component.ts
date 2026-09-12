import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ArrowRight, LucideAngularModule } from 'lucide-angular';
import { z } from 'zod';

import { KycStoreService, emptyKyc, type KycData } from '../../core/kyc-store.service';
import { ButtonComponent } from '../../shared/button.component';
import { StepsComponent } from '../../shared/steps.component';

const schema = z.object({
  customerName: z.string().trim().min(2, 'Enter the customer name').max(100),
  dob: z.string().min(1, 'Date of birth is required'),
  gender: z.string().min(1, 'Select a gender'),
  nationality: z.string().min(1, 'Select a nationality'),
  documentType: z.string().min(1, 'Select a document type'),
  documentNumber: z.string().trim().min(5, 'Enter the document number').max(30, 'Document number is too long'),
  dateOfIssue: z.string().min(1, 'Date of issue is required'),
  dateOfExpiry: z.string().min(1, 'Date of expiry is required'),
});

@Component({
  selector: 'app-kyc-form',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, ButtonComponent, StepsComponent],
  templateUrl: './kyc-form.component.html',
})
export class KycFormComponent {
  readonly icons = { ArrowRight };

  readonly nationalities = [
    'United Arab Emirates',
    'Saudi Arabia',
    'Egypt',
    'India',
    'Pakistan',
    'Philippines',
    'United Kingdom',
    'Other',
  ];

  data: KycData = emptyKyc;
  errors: Record<string, string> = {};

  constructor(
    private readonly kycStore: KycStoreService,
    private readonly router: Router,
  ) {
    this.data = this.kycStore.load();
  }

  err(key: string): string | null {
    return this.errors[key] ?? null;
  }

  onSubmit(): void {
    const parsed = schema.safeParse(this.data);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      this.errors = next;
      return;
    }
    this.errors = {};
    this.kycStore.save(parsed.data);
    this.router.navigateByUrl('/kyc/signature');
  }
}
