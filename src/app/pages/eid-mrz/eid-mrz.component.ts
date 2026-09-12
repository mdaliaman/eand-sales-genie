import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';

import { EidMrzReader, type EidMrzResult } from '@eid-mrz-sdk';

@Component({
  selector: 'app-eid-mrz',
  standalone: true,
  templateUrl: './eid-mrz.component.html',
})
export class EidMrzComponent implements OnInit, OnDestroy {
  /**
   * The shippable SDK. With no `source`, `capture()` opens the device camera,
   * runs OCR and returns the parsed MRZ — all of that lives in the SDK folder.
   */
  private readonly reader = new EidMrzReader();

  readonly raw = signal('');
  readonly capturing = signal(false);
  readonly captureError = signal<string | null>(null);
  readonly cameraSupport = this.reader.cameraSupport;

  /** Parsing is delegated entirely to the SDK. */
  readonly result = computed<EidMrzResult>(() => this.reader.parse(this.raw()));

  readonly fields = computed(() => {
    const data = this.result().data;
    if (!data) return [];
    return [
      { label: 'Document type', value: data.documentTypeName },
      { label: 'Issuing state', value: data.issuingState },
      { label: 'Document number', value: data.documentNumber, ok: data.documentNumberValid },
      { label: 'Emirates ID', value: data.emiratesId ?? '—' },
      { label: 'Surname', value: data.surname },
      { label: 'Given names', value: data.givenNames },
      { label: 'Nationality', value: data.nationality },
      { label: 'Sex', value: this.sexLabel(data.sex) },
      { label: 'Date of birth', value: data.dateOfBirth || '—', ok: data.dateOfBirthValid },
      { label: 'Date of expiry', value: data.dateOfExpiry || '—', ok: data.dateOfExpiryValid },
    ];
  });

  /** Fetch the OCR model now so the first scan does not stall on the download. */
  ngOnInit(): void {
    void this.reader.preload().catch(() => undefined);
  }

  ngOnDestroy(): void {
    void this.reader.dispose().catch(() => undefined);
  }

  /** "Capture MRZ" — the button only triggers this one SDK call. */
  async captureMrz(): Promise<void> {
    this.capturing.set(true);
    this.captureError.set(null);
    try {
      const captured = await this.reader.capture();
      if (captured.success && captured.data) {
        this.raw.set(captured.data.mrzLines.join('\n'));
      } else {
        this.captureError.set(captured.errors[0] ?? 'MRZ capture failed.');
      }
    } finally {
      this.capturing.set(false);
    }
  }

  onInput(value: string): void {
    this.raw.set(value);
    if (this.captureError()) this.captureError.set(null);
  }

  clear(): void {
    this.raw.set('');
    this.captureError.set(null);
  }

  private sexLabel(sex: 'M' | 'F' | 'X'): string {
    if (sex === 'M') return 'Male';
    if (sex === 'F') return 'Female';
    return 'Unspecified';
  }
}
