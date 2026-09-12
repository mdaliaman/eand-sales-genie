/**
 * Full-screen camera MRZ scanner. Everything here is vanilla DOM — no framework.
 *
 *   const scanner = new CameraScanner(options);
 *   const rawMrz = await scanner.scan();   // resolves with a 3-line TD1 string
 *   scanner.dispose();                     // releases the OCR worker
 *
 * `scan()` opens the rear camera, streams it behind an alignment frame, and OCRs
 * the framed band every ~1.2s until a valid Emirates ID TD1 zone is read (or the
 * user taps Capture / Cancel, or it times out).
 */

import { parseMrz } from '../parser';
import type { CameraScannerOptions, OcrEngine } from '../types';
import { createTesseractEngine } from './ocr';
import { extractTd1 } from './mrz-extract';
import { SCANNER_STYLE_ID, scannerCss } from './styles';

const DEFAULT_ACCENT = '#e30613'; // e& red

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
  statusText: HTMLSpanElement;
  statusDot: HTMLSpanElement;
  captureBtn: HTMLButtonElement;
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

  constructor(options: CameraScannerOptions = {}) {
    this.opts = {
      facingMode: options.facingMode ?? 'environment',
      scanIntervalMs: options.scanIntervalMs ?? 1200,
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

      this.buildUi({
        onCancel: () => fail(new MrzCaptureCancelled()),
        onCapture: () => void this.attempt(done, { lenient: true }),
      });
      mount.appendChild(this.ui!.overlay);

      this.startCamera()
        .then(() => {
          this.setStatus('Align the MRZ (the code lines) inside the frame', 'idle');
          this.scheduleLoop(done);
          if (this.opts.timeoutMs > 0) {
            this.timeoutTimer = setTimeout(
              () => fail(new Error('Timed out before a readable MRZ was found.')),
              this.opts.timeoutMs,
            );
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
    // Wait for real dimensions so cropping maths are valid.
    if (!video.videoWidth) {
      await new Promise<void>((r) => {
        video.onloadedmetadata = () => r();
        setTimeout(r, 2000);
      });
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
      void this.attempt(done, { lenient: false }).finally(() => {
        if (!this.settled) this.scheduleLoop(done);
      });
    }, this.opts.scanIntervalMs);
  }

  private async attempt(
    done: (mrz: string) => void,
    { lenient }: { lenient: boolean },
  ): Promise<void> {
    if (this.busy || this.settled || !this.ui) return;
    this.busy = true;
    if (lenient) this.ui.captureBtn.disabled = true;
    this.setStatus(lenient ? 'Reading…' : this.ui.statusText.textContent ?? '', 'busy');

    try {
      const frame = this.grabFrame();
      if (!frame) return;
      const text = await this.ocr.recognize(frame);
      const candidate = extractTd1(text);
      if (!candidate) {
        if (lenient) this.setStatus('No MRZ detected — hold steady and try again', 'error');
        return;
      }

      const parsed = parseMrz(candidate);
      const acceptable =
        parsed.success && (parsed.valid || (lenient && !this.opts.requireValidCheckDigits) || lenient);

      if (acceptable) {
        this.setStatus(parsed.valid ? 'MRZ verified' : 'MRZ captured (check digits unverified)', 'ok');
        done(candidate);
        return;
      }
      this.setStatus(
        parsed.success ? 'Sharpen focus — check digits not matching yet' : 'Keep the code inside the frame',
        lenient ? 'error' : 'idle',
      );
    } catch (err) {
      this.setStatus(this.describeOcrError(err), 'error');
    } finally {
      this.busy = false;
      if (this.ui && !this.settled) this.ui.captureBtn.disabled = false;
    }
  }

  private describeOcrError(err: unknown): string {
    const msg = (err as Error)?.message ?? '';
    if (/tesseract/i.test(msg) || /load/i.test(msg)) {
      return 'OCR engine failed to load. Check the network connection.';
    }
    return 'OCR failed on that frame — trying again';
  }

  /** Crop the alignment band from the video, boost contrast, return a canvas. */
  private grabFrame(): HTMLCanvasElement | null {
    const { video } = this.ui!;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // Alignment frame: 92% width, aspect 7 : 1.4  (matches the CSS frame).
    const bandW = vw * 0.92;
    const bandH = bandW * (1.4 / 7);
    const sx = (vw - bandW) / 2;
    const sy = (vh - bandH) / 2;

    const scale = Math.min(3, 1400 / bandW);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bandW * scale);
    canvas.height = Math.round(bandH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, sx, sy, bandW, bandH, 0, 0, canvas.width, canvas.height);

    // Grayscale + simple contrast stretch — materially improves MRZ OCR.
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const c = g < 110 ? g * 0.6 : g > 150 ? Math.min(255, g * 1.25) : g;
      d[i] = d[i + 1] = d[i + 2] = c;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
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

  private buildUi(handlers: { onCancel: () => void; onCapture: () => void }): void {
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
    close.setAttribute('aria-label', 'Cancel');
    close.addEventListener('click', handlers.onCancel);
    topbar.append(brand, close);

    const stage = el('div', 'eidmrz-stage');
    const video = el('video', 'eidmrz-video');
    const scrim = el('div', 'eidmrz-scrim');
    const frame = el('div', 'eidmrz-frame');
    frame.append(el('i'), el('div', 'eidmrz-scanline'));
    const hint = el(
      'div',
      'eidmrz-hint',
      'Place the two/three code lines from the back of the card inside the frame',
    );
    stage.append(video, scrim, frame, hint);

    const panel = el('div', 'eidmrz-panel');
    const status = el('div', 'eidmrz-status');
    const statusDot = el('span', 'eidmrz-dot');
    const statusText = el('span', undefined, 'Starting camera…');
    status.append(statusDot, statusText);

    const actions = el('div', 'eidmrz-actions');
    const captureBtn = el('button', 'eidmrz-btn eidmrz-btn-primary', 'Capture');
    captureBtn.type = 'button';
    captureBtn.addEventListener('click', handlers.onCapture);
    const cancelBtn = el('button', 'eidmrz-btn eidmrz-btn-ghost', 'Cancel');
    cancelBtn.type = 'button';
    cancelBtn.addEventListener('click', handlers.onCancel);
    actions.append(captureBtn, cancelBtn);
    panel.append(status, actions);

    overlay.append(topbar, stage, panel);
    this.ui = { overlay, video, statusText, statusDot, captureBtn };
  }

  private showErrorCard(message: string, onClose: () => void): void {
    if (!this.ui) return;
    const { overlay } = this.ui;
    const stage = overlay.querySelector('.eidmrz-stage');
    const panel = overlay.querySelector('.eidmrz-panel');
    stage?.remove();
    panel?.remove();

    const card = document.createElement('div');
    card.className = 'eidmrz-error-card';
    const h = document.createElement('h3');
    h.textContent = 'Camera unavailable';
    const p = document.createElement('p');
    p.textContent = message;
    const btn = document.createElement('button');
    btn.className = 'eidmrz-btn eidmrz-btn-primary';
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
