/**
 * The stateful entry point. Host applications create one `EidMrzReader` and call
 * {@link EidMrzReader.capture} from anywhere — a button handler, a route guard,
 * a service. With no `source` configured, `capture()` opens the device camera
 * and scans the MRZ with OCR; the whole camera + OCR flow lives in this SDK.
 *
 *   const reader = new EidMrzReader();
 *   const result = await reader.capture();   // opens camera, returns parsed MRZ
 *
 * {@link EidMrzReader.parse} decodes text you already have.
 */

import { parseMrz } from './parser';
import { SAMPLE_MRZ } from './sample';
import { CameraScanner } from './camera/camera-scanner';
import type { EidMrzReaderOptions, EidMrzResult, MrzSource } from './types';

export class EidMrzReader {
  private source: MrzSource | null;
  private readonly cameraOptions: EidMrzReaderOptions['camera'];
  private scanner: CameraScanner | null = null;

  constructor(options: EidMrzReaderOptions = {}) {
    this.source = options.source ?? null;
    this.cameraOptions = options.camera;
  }

  /** True when `capture()` can open the camera in this environment. */
  get cameraSupported(): boolean {
    return CameraScanner.isSupported();
  }

  /** Camera availability with a human-readable reason when unavailable. */
  get cameraSupport(): { ok: true } | { ok: false; reason: string } {
    return CameraScanner.checkSupport();
  }

  /** Set an explicit MRZ text provider. Pass `null` to fall back to the camera. */
  setSource(source: MrzSource | null): void {
    this.source = source;
  }

  /** Decode raw MRZ text (TD1, 3 × 30). Pure — no camera, no source. */
  parse(raw: string): EidMrzResult {
    return parseMrz(raw);
  }

  /**
   * Obtain MRZ text and parse it. Uses the configured `source` when present,
   * otherwise opens the built-in camera scanner. Always resolves; a cancelled
   * scan or a failing source is surfaced as a structural error.
   */
  async capture(): Promise<EidMrzResult> {
    try {
      const raw = this.source ? await this.source() : await this.scanWithCamera();
      return parseMrz(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        valid: false,
        data: null,
        errors: [message || 'MRZ capture failed.'],
        warnings: [],
      };
    }
  }

  /** Open the camera scanner directly and get the raw MRZ string. */
  scanWithCamera(): Promise<string> {
    if (!this.scanner) this.scanner = new CameraScanner(this.cameraOptions);
    return this.scanner.scan();
  }

  /** Release the OCR worker held by the camera scanner. */
  async dispose(): Promise<void> {
    await this.scanner?.dispose();
    this.scanner = null;
  }
}

/** Ready-to-use singleton. `capture()` opens the camera until you set a source. */
export const eidMrzReader = new EidMrzReader();

/** A `MrzSource` that returns the bundled synthetic sample (useful for demos/tests). */
export const sampleSource: MrzSource = () => SAMPLE_MRZ;
