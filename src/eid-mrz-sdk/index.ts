/**
 * Emirates ID MRZ SDK — a framework-agnostic plugin that captures the MRZ with
 * the device camera and parses it. Copy the whole `eid-mrz-sdk/` folder into any
 * TypeScript / JavaScript project and import from this barrel.
 *
 * ```ts
 * import { EidMrzReader } from './eid-mrz-sdk';
 *
 * const reader = new EidMrzReader();          // no source → camera scanner
 * const result = await reader.capture();      // opens camera, runs OCR, parses
 * if (result.success) console.log(result.data.emiratesId);
 * ```
 *
 * The camera UI and OCR (lazy-loaded Tesseract.js, nothing to `npm install`)
 * all live inside this folder. Parse text you already have with `parseMrz`, or
 * plug a custom pipeline via `new EidMrzReader({ source })`.
 */

export { parseMrz } from './src/parser';
export { EidMrzReader, eidMrzReader, sampleSource } from './src/reader';
export { CameraScanner, MrzCaptureCancelled } from './src/camera/camera-scanner';
export { createTesseractEngine, DEFAULT_TESSERACT_URL } from './src/camera/ocr';
export { extractTd1 } from './src/camera/mrz-extract';
export { computeCheckDigit, verifyCheckDigit, charValue } from './src/check-digit';
export { SAMPLE_MRZ } from './src/sample';
export type {
  EidMrzData,
  EidMrzResult,
  EidMrzReaderOptions,
  CameraScannerOptions,
  OcrEngine,
  MrzSource,
  Sex,
} from './src/types';

import { EidMrzReader } from './src/reader';

/** Default export: the reader class, for `import EidMrzReader from '.../eid-mrz-sdk'`. */
export default EidMrzReader;
