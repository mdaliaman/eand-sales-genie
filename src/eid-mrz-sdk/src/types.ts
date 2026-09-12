/**
 * Public type surface for the Emirates ID MRZ SDK.
 *
 * The SDK has zero runtime dependencies and never imports from a framework,
 * so this file can be copied into any TypeScript project as-is.
 */

export type Sex = 'M' | 'F' | 'X';

/** A single decoded field together with the raw slice it came from. */
export interface EidMrzData {
  /** Document code, e.g. `IL` / `ID`. */
  documentType: string;
  /** Human label derived from {@link documentType}. */
  documentTypeName: string;
  /** Issuing state / organisation (ISO 3166-1 alpha-3), e.g. `ARE`. */
  issuingState: string;
  /** Document (card) number with filler `<` removed. */
  documentNumber: string;
  /** True when the document-number check digit matches. */
  documentNumberValid: boolean;
  /** 15-digit Emirates ID formatted as `784-YYYY-NNNNNNN-C`, or `null` when absent. */
  emiratesId: string | null;
  /** Primary identifier (surname). */
  surname: string;
  /** Secondary identifier (given names), space separated. */
  givenNames: string;
  /** Holder nationality (ISO 3166-1 alpha-3). */
  nationality: string;
  sex: Sex;
  /** Date of birth as ISO `YYYY-MM-DD`. */
  dateOfBirth: string;
  dateOfBirthValid: boolean;
  /** Date of expiry as ISO `YYYY-MM-DD`. */
  dateOfExpiry: string;
  dateOfExpiryValid: boolean;
  /** Optional data element from line 1 (raw, filler stripped). */
  optionalData1: string;
  /** Optional data element from line 2 (raw, filler stripped). */
  optionalData2: string;
  /** True when the composite check digit over the whole zone matches. */
  compositeValid: boolean;
  /** The three normalised 30-character MRZ lines. */
  mrzLines: [string, string, string];
}

export interface EidMrzResult {
  /** The MRZ was structurally well-formed and decoded into fields. */
  success: boolean;
  /** Every check digit (document, DOB, expiry, composite) verified. */
  valid: boolean;
  /** Decoded fields, or `null` when {@link success} is `false`. */
  data: EidMrzData | null;
  /** Structural problems that prevented decoding. */
  errors: string[];
  /** Non-fatal problems — failed check digits, implausible dates. */
  warnings: string[];
}

/**
 * A pluggable MRZ text provider. Return the raw 3-line zone (with or without
 * newlines / spaces — the SDK normalises it). Sync or async.
 *
 * Wire this to a camera OCR pipeline, an NFC read, a file picker, a hardware
 * scanner SDK, or anything else in the host application.
 */
export type MrzSource = () => string | Promise<string>;

/**
 * OCR back-end used by the built-in camera scanner. Receives a cropped frame of
 * the MRZ band and returns the recognised text (any casing / spacing).
 *
 * The SDK ships a lazy-loaded Tesseract.js engine (fetched from a CDN at first
 * use, nothing to `npm install`). Provide your own to use a native MRZ reader,
 * ML Kit, an on-device model, a server endpoint, etc.
 */
export interface OcrEngine {
  recognize(image: HTMLCanvasElement): Promise<string>;
  /** Optional cleanup hook, called when the scanner is disposed. */
  terminate?(): Promise<void> | void;
}

export interface CameraScannerOptions {
  /** Override the OCR back-end. Defaults to lazy-loaded Tesseract.js. */
  ocr?: OcrEngine;
  /** CDN URL for the default Tesseract.js engine. */
  tesseractUrl?: string;
  /** Which camera to request. Defaults to `'environment'` (rear). */
  facingMode?: 'environment' | 'user';
  /** Milliseconds between automatic OCR attempts on the live feed. Default 1200. */
  scanIntervalMs?: number;
  /** Give up and reject after this long. Default 60000. `0` disables the timeout. */
  timeoutMs?: number;
  /**
   * Accept a frame only once every check digit verifies. Default `true`.
   * Set `false` to accept the first structurally valid TD1 read.
   */
  requireValidCheckDigits?: boolean;
  /** Element the full-screen scanner UI is appended to. Default `document.body`. */
  mountEl?: HTMLElement;
  /** Accent colour for the scanner UI. Default e& red `#e30613`. */
  accentColor?: string;
}

export interface EidMrzReaderOptions {
  /**
   * Provider used by {@link EidMrzReader.capture}. When omitted, `capture()`
   * opens the device camera and scans the MRZ with OCR.
   */
  source?: MrzSource;
  /** Options forwarded to the built-in camera scanner. */
  camera?: CameraScannerOptions;
}
