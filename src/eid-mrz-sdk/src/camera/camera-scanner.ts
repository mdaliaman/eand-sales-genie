/**
 * Full-screen camera MRZ scanner. Everything here is vanilla DOM — no framework.
 *
 *   const scanner = new CameraScanner(options);
 *   const rawMrz = await scanner.scan();   // resolves with a 3-line TD1 string
 *   scanner.dispose();                     // releases the OCR worker
 *
 * `scan()` opens the rear camera behind a card-shaped view finder and reads the
 * MRZ **automatically** — there is nothing for the user to tap. The only control
 * is a close button. It resolves as soon as a TD1 zone whose check digits verify
 * is recognised.
 */

import { parseMrz } from '../parser';
import type { CameraScannerOptions, EidMrzData, OcrEngine } from '../types';
import { createTesseractEngine } from './ocr';
import { extractTd1 } from './mrz-extract';
import { MRZ_BAND_HEIGHT, MRZ_BAND_INSET, SCANNER_STYLE_ID, scannerCss } from './styles';

const DEFAULT_ACCENT = '#e30613'; // e& red

/** A normalised sub-rectangle of the view finder, in 0–1 fractions. */
interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The MRZ band at the foot of the card — the primary place we look. */
const BAND_REGION: Region = {
  x: MRZ_BAND_INSET,
  y: 1 - MRZ_BAND_HEIGHT,
  w: 1 - MRZ_BAND_INSET * 2,
  h: MRZ_BAND_HEIGHT,
};
/** The whole view finder — a fallback for when the card is framed loosely. */
const FULL_REGION: Region = { x: 0, y: 0, w: 1, h: 1 };

/** Rejection reason when the user dismisses the scanner. */
export class MrzCaptureCancelled extends Error {
  constructor(message = 'MRZ capture was cancelled.') {
    super(message);
    this.name = 'MrzCaptureCancelled';
  }
}

interface ScanUi {
  overlay: HTMLDivElement;
  video: HTMLVideoElement;
  frame: HTMLDivElement;
  statusText: HTMLSpanElement;
  statusDot: HTMLSpanElement;
}

export class CameraScanner {
  private readonly opts: Required<Omit<CameraScannerOptions, 'ocr' | 'mountEl' | 'tesseractUrl'>> & {
    mountEl: HTMLElement | null;
  };
  private readonly ocr: OcrEngine;

  private stream: MediaStream | null = null;
  private ui: ScanUi | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private settled = false;
  private attempts = 0;
  /** Last structurally valid read, used if the scan times out before verifying. */
  private bestCandidate: string | null = null;

  constructor(options: CameraScannerOptions = {}) {
    this.opts = {
      facingMode: options.facingMode ?? 'environment',
      scanIntervalMs: options.scanIntervalMs ?? 700,
      timeoutMs: options.timeoutMs ?? 60000,
      requireValidCheckDigits: options.requireValidCheckDigits ?? true,
      accentColor: options.accentColor ?? DEFAULT_ACCENT,
      mountEl: options.mountEl ?? null,
    };
    this.ocr = options.ocr ?? createTesseractEngine(options.tesseractUrl);
  }

  /** Whether this environment can run the camera scanner at all. */
  static isSupported(): boolean {
    return CameraScanner.checkSupport().ok;
  }

  /**
   * Diagnose camera availability. The common failure on phones is an **insecure
   * origin**: browsers only expose `getUserMedia` on HTTPS or `localhost`, so a
   * dev server opened at `http://<lan-ip>:port` has no camera API at all.
   */
  static checkSupport(): { ok: true } | { ok: false; reason: string } {
    if (typeof document === 'undefined' || typeof navigator === 'undefined') {
      return { ok: false, reason: 'Camera capture needs a browser environment.' };
    }
    const insecure =
      typeof window !== 'undefined' &&
      window.isSecureContext === false &&
      location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1';
    if (!navigator.mediaDevices?.getUserMedia) {
      if (insecure) {
        return {
          ok: false,
          reason:
            `The camera is blocked because this page is not on a secure origin ` +
            `(${location.protocol}//${location.host}). Open the app over HTTPS or ` +
            `via localhost — phones disable the camera API on plain http:// addresses.`,
        };
      }
      return { ok: false, reason: 'This browser does not provide a camera API.' };
    }
    return { ok: true };
  }

  /** Open the camera and resolve with a raw 3-line TD1 MRZ string. */
  scan(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const support = CameraScanner.checkSupport();
      if (!support.ok) {
        reject(new Error(support.reason));
        return;
      }
      if (this.ui) {
        reject(new Error('A scan is already in progress.'));
        return;
      }

      // Reset per-scan state so the same instance can be scanned with repeatedly.
      this.settled = false;
      this.busy = false;
      this.attempts = 0;
      this.bestCandidate = null;

      const settle = (fn: () => void) => {
        if (this.settled) return;
        this.settled = true;
        this.teardown();
        fn();
      };
      const done = (mrz: string) => settle(() => resolve(mrz));
      const fail = (err: Error) => settle(() => reject(err));

      this.mountStyle();
      const mount = this.opts.mountEl ?? document.body;

      this.buildUi({ onCancel: () => fail(new MrzCaptureCancelled()) });
      mount.appendChild(this.ui!.overlay);

      this.startCamera()
        .then(() => {
          this.setStatus('Fit the back of the card inside the frame', 'idle');
          this.scheduleLoop(done);
          if (this.opts.timeoutMs > 0) {
            this.timeoutTimer = setTimeout(() => {
              // Rather than losing a good-but-unverified read, hand it back.
              if (this.bestCandidate) done(this.bestCandidate);
              else fail(new Error('Timed out before a readable MRZ was found.'));
            }, this.opts.timeoutMs);
          }
        })
        .catch((err: unknown) => {
          const message = this.describeCameraError(err);
          if (this.ui) this.showErrorCard(message, () => fail(new MrzCaptureCancelled()));
          else fail(new Error(message));
        });
    });
  }

  /** Release the OCR worker. Call when the host is finished with the scanner. */
  async dispose(): Promise<void> {
    this.teardown();
    await this.ocr.terminate?.();
  }

  // ---------------------------------------------------------------- camera ----

  private async startCamera(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: this.opts.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
    const { video } = this.ui!;
    video.srcObject = this.stream;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    await video.play().catch(() => undefined);
    // Wait for real dimensions so the crop maths are valid.
    if (!video.videoWidth) {
      await new Promise<void>((r) => {
        video.onloadedmetadata = () => r();
        setTimeout(r, 2000);
      });
    }
    await this.applyFocusHints();
  }

  /** Ask for continuous autofocus / macro-ish behaviour where supported. */
  private async applyFocusHints(): Promise<void> {
    const track = this.stream?.getVideoTracks()[0];
    if (!track?.applyConstraints) return;
    const caps = track.getCapabilities?.() as { focusMode?: string[] } | undefined;
    if (caps?.focusMode?.includes('continuous')) {
      await track
        .applyConstraints({
          advanced: [{ focusMode: 'continuous' }],
        } as unknown as MediaTrackConstraints)
        .catch(() => undefined);
    }
  }

  private describeCameraError(err: unknown): string {
    const name = (err as { name?: string })?.name ?? '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Camera permission was denied. Allow camera access and try again.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'No suitable camera was found on this device.';
    }
    if (name === 'NotReadableError') {
      return 'The camera is already in use by another application.';
    }
    return (err as Error)?.message || 'Could not start the camera.';
  }

  // ------------------------------------------------------------------ loop ----

  private scheduleLoop(done: (mrz: string) => void): void {
    this.loopTimer = setTimeout(() => {
      void this.attempt(done).finally(() => {
        if (!this.settled) this.scheduleLoop(done);
      });
    }, this.opts.scanIntervalMs);
  }

  private async attempt(done: (mrz: string) => void): Promise<void> {
    if (this.busy || this.settled || !this.ui) return;
    this.busy = true;
    this.attempts += 1;

    // Mostly read the MRZ band; every third pass sweep the whole card in case
    // the holder framed it loosely.
    const region = this.attempts % 3 === 0 ? FULL_REGION : BAND_REGION;

    try {
      const frame = this.grabFrame(region);
      if (!frame) return;
      this.setStatus('Reading…', 'busy');

      const text = await this.ocr.recognize(frame);
      if (this.settled) return;

      const candidate = extractTd1(text);
      if (!candidate) {
        this.setStatus('Hold steady — looking for the code lines', 'idle');
        return;
      }

      const parsed = parseMrz(candidate);
      // Only remember a near-miss: at least half the check digits must verify,
      // otherwise the timeout fallback could hand back a misread.
      if (parsed.success && this.passingChecks(parsed.data) >= 2) {
        this.bestCandidate = candidate;
      }

      if (parsed.valid || (parsed.success && !this.opts.requireValidCheckDigits)) {
        this.setStatus('MRZ verified', 'ok');
        done(candidate);
        return;
      }
      this.setStatus(
        parsed.success
          ? 'Almost — hold still so every character is sharp'
          : 'Hold steady — looking for the code lines',
        parsed.success ? 'error' : 'idle',
      );
    } catch (err) {
      this.setStatus(this.describeOcrError(err), 'error');
    } finally {
      this.busy = false;
    }
  }

  /** How many of the four TD1 check digits verified. */
  private passingChecks(data: EidMrzData | null): number {
    if (!data) return 0;
    return (
      Number(data.documentNumberValid) +
      Number(data.dateOfBirthValid) +
      Number(data.dateOfExpiryValid) +
      Number(data.compositeValid)
    );
  }

  private describeOcrError(err: unknown): string {
    const msg = (err as Error)?.message ?? '';
    if (/tesseract/i.test(msg) || /load/i.test(msg)) {
      return 'OCR engine failed to load. Check the network connection.';
    }
    return 'That frame could not be read — trying again';
  }

  /**
   * Crop `region` of the view finder out of the video and return it as a canvas.
   *
   * The video is rendered with `object-fit: cover`, so the on-screen frame has to
   * be mapped back through that scale/offset to source pixels.
   */
  private grabFrame(region: Region): HTMLCanvasElement | null {
    const { video, frame } = this.ui!;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const videoBox = video.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    if (!videoBox.width || !frameBox.width) return null;

    // `object-fit: cover` scales by the larger ratio and centres the overflow.
    const scale = Math.max(videoBox.width / vw, videoBox.height / vh);
    const offX = (videoBox.width - vw * scale) / 2;
    const offY = (videoBox.height - vh * scale) / 2;

    const toSource = (clientX: number, clientY: number) => ({
      x: (clientX - videoBox.left - offX) / scale,
      y: (clientY - videoBox.top - offY) / scale,
    });

    const topLeft = toSource(
      frameBox.left + frameBox.width * region.x,
      frameBox.top + frameBox.height * region.y,
    );
    const sw = (frameBox.width * region.w) / scale;
    const sh = (frameBox.height * region.h) / scale;

    // Clamp into the source frame.
    const sx = Math.max(0, Math.min(topLeft.x, vw - 1));
    const sy = Math.max(0, Math.min(topLeft.y, vh - 1));
    const cw = Math.max(1, Math.min(sw, vw - sx));
    const ch = Math.max(1, Math.min(sh, vh - sy));

    // Upscale modestly — Tesseract wants roughly 25-40px tall glyphs.
    const outScale = Math.min(3, 1500 / cw);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cw * outScale);
    canvas.height = Math.round(ch * outScale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
    this.sharpenForOcr(ctx, canvas.width, canvas.height);
    return canvas;
  }

  /** Grayscale + adaptive contrast stretch — materially improves MRZ OCR. */
  private sharpenForOcr(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    let min = 255;
    let max = 0;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
      const g = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
      gray[p] = g;
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const span = Math.max(1, max - min);
    for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
      // Stretch to full range, then push mid-tones apart.
      const n = ((gray[p] - min) / span) * 255;
      const c = n < 128 ? n * 0.72 : Math.min(255, 128 + (n - 128) * 1.35);
      d[i] = d[i + 1] = d[i + 2] = c;
    }
    ctx.putImageData(img, 0, 0);
  }

  // -------------------------------------------------------------------- ui ----

  private mountStyle(): void {
    if (typeof document === 'undefined') return;
    if (document.getElementById(SCANNER_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SCANNER_STYLE_ID;
    style.textContent = scannerCss(this.opts.accentColor);
    document.head.appendChild(style);
    this.styleEl = style;
  }

  private buildUi(handlers: { onCancel: () => void }): void {
    const el = <K extends keyof HTMLElementTagNameMap>(
      tag: K,
      className?: string,
      text?: string,
    ): HTMLElementTagNameMap[K] => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    };

    const overlay = el('div', 'eidmrz-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Scan Emirates ID MRZ');

    const topbar = el('div', 'eidmrz-topbar');
    const brand = el('div', 'eidmrz-brand');
    brand.append(el('span', 'eidmrz-logo', 'e&'), el('span', 'eidmrz-title', 'Emirates ID · MRZ scan'));
    const close = el('button', 'eidmrz-close', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close scanner');
    close.addEventListener('click', handlers.onCancel);
    topbar.append(brand, close);

    const stage = el('div', 'eidmrz-stage');
    const video = el('video', 'eidmrz-video');

    const frame = el('div', 'eidmrz-frame');
    for (const corner of ['tl', 'tr', 'bl', 'br']) {
      frame.appendChild(el('span', `eidmrz-corner ${corner}`));
    }
    const band = el('div', 'eidmrz-band');
    band.append(el('span', 'eidmrz-band-label', 'MRZ'), el('div', 'eidmrz-scanline'));
    frame.appendChild(band);

    const status = el('div', 'eidmrz-status');
    const statusDot = el('span', 'eidmrz-dot');
    const statusText = el('span', undefined, 'Starting camera…');
    status.append(statusDot, statusText);

    stage.append(video, frame, status);
    overlay.append(topbar, stage);

    // Escape closes, matching the ✕.
    overlay.tabIndex = -1;
    overlay.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') handlers.onCancel();
    });

    this.ui = { overlay, video, frame, statusText, statusDot };
    queueMicrotask(() => overlay.focus?.());
  }

  private showErrorCard(message: string, onClose: () => void): void {
    if (!this.ui) return;
    const { overlay } = this.ui;
    overlay.querySelector('.eidmrz-stage')?.remove();

    const card = document.createElement('div');
    card.className = 'eidmrz-error-card';
    const h = document.createElement('h3');
    h.textContent = 'Camera unavailable';
    const p = document.createElement('p');
    p.textContent = message;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Close';
    btn.addEventListener('click', onClose);
    card.append(h, p, btn);
    overlay.appendChild(card);
  }

  private setStatus(text: string, state: 'idle' | 'busy' | 'ok' | 'error'): void {
    if (!this.ui) return;
    this.ui.statusText.textContent = text;
    this.ui.statusDot.className =
      'eidmrz-dot' +
      (state === 'busy' ? ' is-busy' : state === 'ok' ? ' is-ok' : state === 'error' ? ' is-error' : '');
  }

  // -------------------------------------------------------------- teardown ----

  private teardown(): void {
    if (this.loopTimer) clearTimeout(this.loopTimer);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    this.loopTimer = null;
    this.timeoutTimer = null;

    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;

    if (this.ui?.video) this.ui.video.srcObject = null;
    this.ui?.overlay.remove();
    this.ui = null;

    this.styleEl?.remove();
    this.styleEl = null;
  }
}
