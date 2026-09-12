/**
 * Scoped stylesheet for the camera scanner overlay, injected once at scan time
 * and removed on dispose. Visual language follows eand.com — white surfaces,
 * near-black text, e& red accent, generous rounding, pill buttons.
 */

export const SCANNER_STYLE_ID = 'eid-mrz-scanner-style';

export function scannerCss(accent: string): string {
  return `
.eidmrz-overlay {
  position: fixed; inset: 0; z-index: 2147483000;
  display: flex; flex-direction: column;
  background: #0b0b0cF2;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #fff; -webkit-font-smoothing: antialiased;
}
.eidmrz-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; gap: 12px;
}
.eidmrz-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: .2px; }
.eidmrz-brand .eidmrz-logo {
  color: ${accent}; font-size: 22px; font-weight: 800; line-height: 1;
}
.eidmrz-title { font-size: 14px; font-weight: 600; opacity: .85; }
.eidmrz-close {
  appearance: none; border: 0; background: #ffffff1a; color: #fff;
  width: 36px; height: 36px; border-radius: 999px; font-size: 18px; cursor: pointer;
  display: grid; place-items: center; transition: background .15s ease;
}
.eidmrz-close:hover { background: #ffffff33; }
.eidmrz-stage {
  position: relative; flex: 1; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.eidmrz-video {
  position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; background: #000;
}
.eidmrz-scrim { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 30%, #000000A6 100%); }
.eidmrz-frame {
  position: relative; width: min(92vw, 680px); aspect-ratio: 7 / 1.4;
  border-radius: 14px; box-shadow: 0 0 0 100vmax #000000A6;
  outline: 2px solid #ffffffcc;
}
.eidmrz-frame::before, .eidmrz-frame::after,
.eidmrz-frame > i::before, .eidmrz-frame > i::after {
  content: ""; position: absolute; width: 26px; height: 26px;
  border: 3px solid ${accent}; border-radius: 4px;
}
.eidmrz-frame::before { top: -3px; left: -3px; border-right: 0; border-bottom: 0; }
.eidmrz-frame::after { top: -3px; right: -3px; border-left: 0; border-bottom: 0; }
.eidmrz-frame > i::before { bottom: -3px; left: -3px; border-right: 0; border-top: 0; }
.eidmrz-frame > i::after { bottom: -3px; right: -3px; border-left: 0; border-top: 0; }
.eidmrz-scanline {
  position: absolute; left: 6px; right: 6px; height: 2px; top: 6px;
  background: ${accent}; box-shadow: 0 0 12px ${accent};
  animation: eidmrz-sweep 2.1s ease-in-out infinite;
}
@keyframes eidmrz-sweep { 0%,100% { transform: translateY(0); } 50% { transform: translateY(calc(100% - 12px)); } }
.eidmrz-hint {
  position: absolute; left: 0; right: 0; bottom: 18px; text-align: center;
  font-size: 13px; opacity: .9; padding: 0 20px;
}
.eidmrz-panel {
  padding: 18px 20px calc(18px + env(safe-area-inset-bottom, 0px));
  background: #fff; color: #111;
  border-top-left-radius: 20px; border-top-right-radius: 20px;
}
.eidmrz-status {
  display: flex; align-items: center; gap: 10px;
  font-size: 14px; font-weight: 600; margin-bottom: 14px; min-height: 20px;
}
.eidmrz-dot { width: 9px; height: 9px; border-radius: 999px; background: ${accent}; flex: none; }
.eidmrz-dot.is-busy { animation: eidmrz-pulse 1s ease-in-out infinite; }
.eidmrz-dot.is-ok { background: #128a4b; animation: none; }
.eidmrz-dot.is-error { background: #c81e1e; animation: none; }
@keyframes eidmrz-pulse { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
.eidmrz-actions { display: flex; gap: 10px; }
.eidmrz-btn {
  appearance: none; border: 0; cursor: pointer; font: inherit; font-weight: 700;
  border-radius: 999px; padding: 13px 20px; transition: transform .05s ease, opacity .15s ease;
}
.eidmrz-btn:active { transform: translateY(1px); }
.eidmrz-btn[disabled] { opacity: .5; cursor: default; }
.eidmrz-btn-primary { background: ${accent}; color: #fff; flex: 1; }
.eidmrz-btn-ghost { background: #f1f1f2; color: #111; }
.eidmrz-error-card {
  padding: 22px; margin: auto; max-width: 360px; text-align: center;
  background: #fff; color: #111; border-radius: 18px;
}
.eidmrz-error-card h3 { margin: 0 0 8px; font-size: 16px; }
.eidmrz-error-card p { margin: 0 0 18px; font-size: 13px; color: #555; line-height: 1.5; }
@media (prefers-reduced-motion: reduce) {
  .eidmrz-scanline, .eidmrz-dot.is-busy { animation: none; }
}
`;
}
