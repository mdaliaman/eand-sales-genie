import { Injectable } from '@angular/core';

export type KycData = {
  customerName: string;
  dob: string;
  gender: string;
  nationality: string;
  documentType: string;
  documentNumber: string;
  dateOfIssue: string;
  dateOfExpiry: string;
};

const KEY = 'eand-kyc-draft';

export const emptyKyc: KycData = {
  customerName: '',
  dob: '',
  gender: '',
  nationality: '',
  documentType: 'Emirates ID',
  documentNumber: '',
  dateOfIssue: '',
  dateOfExpiry: '',
};

@Injectable({ providedIn: 'root' })
export class KycStoreService {
  load(): KycData {
    if (typeof window === 'undefined') return emptyKyc;
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? { ...emptyKyc, ...(JSON.parse(raw) as KycData) } : emptyKyc;
    } catch {
      return emptyKyc;
    }
  }

  save(data: KycData): void {
    sessionStorage.setItem(KEY, JSON.stringify(data));
  }

  clear(): void {
    sessionStorage.removeItem(KEY);
  }
}
