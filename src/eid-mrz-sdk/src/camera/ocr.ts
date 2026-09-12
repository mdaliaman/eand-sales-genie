/**
 * Default OCR back-end for the camera scanner: Tesseract.js, lazy-loaded from a
 * CDN the first time it is needed. Nothing is added to `package.json`, so the
 * SDK folder stays copy-paste portable.
 *
 * Swap it out entirely by passing your own {@link OcrEngine} to the scanner.
 */

import type { OcrEngine } from '../types';

const DEFAULT_TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

/**
 * The `tessdata_fast` integer models: ~1.9 MB against ~10.7 MB for the stock set,
 * and measurably quicker per frame. MRZ glyphs are a clean, fixed-width subset,
 * so the heavier models buy nothing here. Override via `camera.langPath`.
 */
const DEFAULT_LANG_PATH = 'https://tessdata.projectnaptha.com/4.0.0_fast';

/** MRZ alphabet — restricting recognition to it sharply improves accuracy. */
const MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

interface TesseractGlobal {
  createWorker(
    lang?: string,
    oem?: number,
    opts?: Record<string, unknown>,
  ): Promise<TesseractWorker>;
}

interface TesseractWorker {
  setParameters(params: Record<string, unknown>): Promise<unknown>;
  recognize(image: HTMLCanvasElement): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}

let scriptPromise: Promise<TesseractGlobal> | null = null;

/** Inject the Tesseract UMD bundle once and resolve with the global object. */
function loadTesseract(url: string): Promise<TesseractGlobal> {
  const existing = (globalThis as { Tesseract?: TesseractGlobal }).Tesseract;
  if (existing) return Promise.resolve(existing);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TesseractGlobal>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Tesseract.js needs a browser environment.'));
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      const tesseract = (globalThis as { Tesseract?: TesseractGlobal }).Tesseract;
      if (tesseract) resolve(tesseract);
      else reject(new Error('Tesseract.js loaded but did not register a global.'));
    };
    script.onerror = () =>
      reject(new Error(`Could not load Tesseract.js from ${url}. Check the network / CSP.`));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Build the default engine. The Tesseract worker is created lazily on the first
 * `recognize` call (or eagerly via `warmUp`) and reused afterwards.
 *
 * The tuning here matters: an MRZ is not natural language, so every dictionary
 * and adaptive-learning pass Tesseract runs by default is wasted work that also
 * drags recognitions toward real words.
 */
export function createTesseractEngine(
  url: string = DEFAULT_TESSERACT_URL,
  langPath: string = DEFAULT_LANG_PATH,
): OcrEngine {
  let workerPromise: Promise<TesseractWorker> | null = null;

  const getWorker = async (): Promise<TesseractWorker> => {
    if (workerPromise) return workerPromise;
    workerPromise = (async () => {
      const tesseract = await loadTesseract(url);
      // OEM 1 = LSTM only; the legacy engine adds startup cost we never use.
      const worker = await tesseract.createWorker('eng', 1, { langPath, cacheMethod: 'write' });
      await worker.setParameters({
        tessedit_char_whitelist: MRZ_CHARS,
        // PSM 6 – assume a single uniform block of text.
        tessedit_pageseg_mode: '6',
        // No dictionaries: an MRZ contains no words.
        load_system_dawg: '0',
        load_freq_dawg: '0',
        load_number_dawg: '0',
        load_punc_dawg: '0',
        load_unambig_dawg: '0',
        load_bigram_dawg: '0',
        // No adaptive classifier: we get one short block per frame, so the
        // training pass never pays for itself.
        classify_enable_learning: '0',
        classify_enable_adaptive_matcher: '0',
      });
      return worker;
    })();
    return workerPromise;
  };

  return {
    /** Download and spin up the worker ahead of the first frame. */
    async warmUp(): Promise<void> {
      await getWorker();
    },
    async recognize(image: HTMLCanvasElement): Promise<string> {
      const worker = await getWorker();
      const { data } = await worker.recognize(image);
      return data.text ?? '';
    },
    async terminate(): Promise<void> {
      if (!workerPromise) return;
      const worker = await workerPromise.catch(() => null);
      workerPromise = null;
      await worker?.terminate().catch(() => undefined);
    },
  };
}

export { DEFAULT_TESSERACT_URL, DEFAULT_LANG_PATH };
