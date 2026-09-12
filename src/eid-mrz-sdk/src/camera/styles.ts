/**
 * Scoped stylesheet for the camera scanner overlay, injected once at scan time
 * and removed on dispose. Visual language follows eand.com — near-black stage,
 * e& red accent, generous rounding.
 *
 * The UI is deliberately chrome-free: a card-shaped view finder, a status line
 * and a single close control. Detection is automatic; there is nothing to tap.
 */

export const SCANNER_STYLE_ID = 'eid-mrz-scanner-style';

/** ID-1 card proportions (85.6mm × 54mm) — the view finder matches the card. */
export const CARD_ASPECT = 85.6 / 54;

/** Fraction of the card height, measured from the bottom, that is OCR'd. */
export const MRZ_BAND_HEIGHT = 0.44;
/** Horizontal inset of the OCR band, as a fraction of card width. */
export const MRZ_BAND_INSET = 0.02;

export function scannerCss(accent: string): string {
  return `
.eidmrz-overlay {
  position: fixed; inset: 0; z-index: 2147483000;
  display: flex; flex-direction: column;
  background: #0b0b0c;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #fff; -webkit-font-smoothing: antialiased;
  overscroll-behavior: contain;
}
.eidmrz-topbar {
  position: relative; z-index: 3;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: calc(14px + env(safe-area-inset-top, 0px)) 18px 14px;
}
.eidmrz-brand { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.eidmrz-logo { color: ${accent}; font-size: 22px; font-weight: 800; line-height: 1; }
.eidmrz-title {
  font-size: 13px; font-weight: 600; opacity: .8;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.eidmrz-close {
  appearance: none; border: 0; background: #ffffff1f; color: #fff; flex: none;
  width: 40px; height: 40px; border-radius: 999px; font-size: 17px; line-height: 1;
  cursor: pointer; display: grid; place-items: center; transition: background .15s ease;
}
.eidmrz-close:hover, .eidmrz-close:focus-visible { background: #ffffff38; outline: none; }

.eidmrz-stage {
  position: relative; flex: 1; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 26px; padding: 12px 16px calc(24px + env(safe-area-inset-bottom, 0px));
}
.eidmrz-video {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; background: #000;
}

/* Card-shaped view finder. The huge box-shadow dims everything outside it. */
.eidmrz-frame {
  position: relative; flex: none;
  width: min(86vw, 430px); max-height: 62vh; aspect-ratio: ${CARD_ASPECT.toFixed(3)};
  border-radius: 16px;
  box-shadow: 0 0 0 100vmax #000000AD;
  outline: 1.5px solid #ffffff5c;
}
.eidmrz-corner { position: absolute; width: 28px; height: 28px; }
.eidmrz-corner::before {
  content: ""; position: absolute; inset: 0;
  border: 3px solid ${accent}; border-radius: 5px;
}
.eidmrz-corner.tl { top: -2px; left: -2px; }
.eidmrz-corner.tl::before { border-right: 0; border-bottom: 0; }
.eidmrz-corner.tr { top: -2px; right: -2px; }
.eidmrz-corner.tr::before { border-left: 0; border-bottom: 0; }
.eidmrz-corner.bl { bottom: -2px; left: -2px; }
.eidmrz-corner.bl::before { border-right: 0; border-top: 0; }
.eidmrz-corner.br { bottom: -2px; right: -2px; }
.eidmrz-corner.br::before { border-left: 0; border-top: 0; }

/* Guide showing where the code lines should sit on the back of the card. */
.eidmrz-band {
  position: absolute; left: 4%; right: 4%; bottom: 5%; height: 34%;
  border: 1.5px dashed #ffffff59; border-radius: 7px;
}
.eidmrz-band-label {
  position: absolute; top: -8px; left: 10px; padding: 0 6px;
  background: #101011; color: #ffffffb3;
  font-size: 9px; font-weight: 700; letter-spacing: .14em;
}
.eidmrz-scanline {
  position: absolute; left: 3px; right: 3px; height: 2px; top: 3px;
  background: ${accent}; border-radius: 2px; box-shadow: 0 0 14px ${accent};
  animation: eidmrz-sweep 2.4s ease-in-out infinite;
}
@keyframes eidmrz-sweep { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(calc(100% - 8px)); } }

.eidmrz-status {
  position: relative; z-index: 2; flex: none;
  display: flex; align-items: center; justify-content: center; gap: 9px;
  max-width: 30rem; min-height: 22px; text-align: center;
  font-size: 14px; font-weight: 600; line-height: 1.4;
  text-shadow: 0 1px 4px #000000cc;
}
.eidmrz-dot { width: 9px; height: 9px; border-radius: 999px; background: ${accent}; flex: none; }
.eidmrz-dot.is-busy { animation: eidmrz-pulse 1s ease-in-out infinite; }
.eidmrz-dot.is-ok { background: #22c55e; animation: none; }
.eidmrz-dot.is-error { background: #f59e0b; animation: none; }
@keyframes eidmrz-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }

.eidmrz-error-card {
  padding: 24px; margin: auto; max-width: 340px; text-align: center;
  background: #fff; color: #111; border-radius: 18px;
}
.eidmrz-error-card h3 { margin: 0 0 8px; font-size: 16px; }
.eidmrz-error-card p { margin: 0 0 18px; font-size: 13px; color: #555; line-height: 1.55; }
.eidmrz-error-card button {
  appearance: none; border: 0; cursor: pointer; font: inherit; font-weight: 700;
  border-radius: 999px; padding: 12px 26px; background: ${accent}; color: #fff;
}
@media (prefers-reduced-motion: reduce) {
  .eidmrz-scanline, .eidmrz-dot.is-busy { animation: none; }
}
`;
}
