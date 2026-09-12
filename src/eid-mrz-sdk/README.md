# Emirates ID MRZ SDK

A self-contained plugin that **scans the Emirates ID MRZ with the device camera**
and **parses** it. The camera UI, the OCR pipeline and the ICAO 9303 parser all
live in this one folder.

- **Portable.** Copy `eid-mrz-sdk/` into any TS/JS project and import it. Nothing
  to `npm install` — Tesseract.js is fetched from a CDN the first time OCR runs.
- **Framework-agnostic.** Vanilla DOM only; no Angular / React / Vue imports.
- **One call.** A button handler just does `await reader.capture()`.

The Emirates ID carries an ICAO 9303 **TD1** zone: 3 lines × 30 characters.

---

## Install

Copy the entire `eid-mrz-sdk/` directory into your project (e.g. `src/lib/eid-mrz-sdk/`)
and import from its `index.ts`.

Optional — add a path alias so imports stay stable wherever the folder lives:

```jsonc
// tsconfig.json
"paths": { "@eid-mrz-sdk": ["src/lib/eid-mrz-sdk/index.ts"] }
```

Requirements for the camera: a **secure context** (HTTPS or `localhost`) and user
permission. Everything else degrades to pasting text.

---

## Usage

### Capture from the camera (default)

```ts
import { EidMrzReader } from '@eid-mrz-sdk';

const reader = new EidMrzReader();

// ...from anywhere — a click handler, a service, a route guard:
async function onCaptureClick() {
  const result = await reader.capture();   // opens the camera, scans, parses
  if (result.success) {
    console.log(result.data.emiratesId);   // "784-1995-1234567-0"
    console.log(result.data.dateOfExpiry); // "2030-01-01"
    console.log(result.valid);             // true → every check digit matched
  } else {
    console.warn(result.errors[0]);        // e.g. "MRZ capture was cancelled."
  }
}
```

`capture()` **always resolves**. A cancelled scan, a denied camera permission or
a timeout come back as `{ success: false, errors: [...] }`.

The scanner opens a full-screen overlay (e& theme) with a **card-shaped view
finder** sized to ID-1 proportions (85.6 × 54 mm) and a dashed guide showing
where the code lines sit on the back of the card.

Detection is **fully automatic — there is nothing to tap.** It OCRs the MRZ band
a few times a second (sweeping the whole finder every third pass, in case the
card is framed loosely) and resolves the moment a TD1 zone whose check digits
verify is recognised. The only control is the **✕** close button (Escape also
works), so an agent can back out.

### Parse text you already have

```ts
import { parseMrz } from '@eid-mrz-sdk';

const result = parseMrz(`
ILARE7841995120784199512345670
9501016M3001019ARE<<<<<<<<<<<1
ALMANSOORI<<AISHA<KHALID<<<<<<
`);
```

### Custom capture source (skip the built-in camera)

```ts
const reader = new EidMrzReader({
  source: async () => nativeScanner.readMrz(), // your NFC / native SDK / upload
});
await reader.capture();
```

### Custom OCR engine

```ts
const reader = new EidMrzReader({
  camera: {
    ocr: { recognize: (canvas) => myModel.readText(canvas) },
    facingMode: 'environment',
    timeoutMs: 45_000,
    accentColor: '#e30613',
  },
});
```

---

## API

| Export | Kind | Purpose |
| --- | --- | --- |
| `EidMrzReader` | class | `capture()` (camera or `source`), `parse()`, `preload()`, `scanWithCamera()`, `dispose()` |
| `parseMrz(raw)` | function | Pure parser → `EidMrzResult` |
| `CameraScanner` | class | Standalone camera overlay; `scan()` → raw TD1 string |
| `MrzCaptureCancelled` | error | Thrown by `CameraScanner.scan()` when dismissed |
| `createTesseractEngine(url?)` | function | The default lazy-loaded OCR engine |
| `extractTd1(ocrText)` | function | Repair a noisy OCR dump into a 3×30 candidate |
| `computeCheckDigit` / `verifyCheckDigit` / `charValue` | functions | ICAO 9303 check-digit maths |
| `SAMPLE_MRZ` / `sampleSource` | const | Valid synthetic zone / a `MrzSource` for it |

### `EidMrzReaderOptions`

```ts
{
  source?: () => string | Promise<string>;  // omit → use the camera
  camera?: CameraScannerOptions;
}
```

### `CameraScannerOptions`

```ts
{
  ocr?: OcrEngine;                 // default: lazy Tesseract.js
  tesseractUrl?: string;           // CDN override for the default engine
  langPath?: string;               // where traineddata is fetched from
  onFrame?: (i: { ms: number; found: boolean }) => void;  // profiling hook
  facingMode?: 'environment' | 'user';   // default 'environment'
  scanIntervalMs?: number;         // gap between auto attempts, default 700
  timeoutMs?: number;              // default 60000; 0 disables
  requireValidCheckDigits?: boolean; // default true
  mountEl?: HTMLElement;           // default document.body
  accentColor?: string;            // default '#e30613' (e&)
}
```

### `EidMrzResult`

```ts
{
  success: boolean;   // structurally decoded into fields
  valid: boolean;     // all check digits (doc, DOB, expiry, composite) matched
  data: EidMrzData | null;
  errors: string[];   // structural / capture problems
  warnings: string[]; // failed check digits, implausible dates
}
```

### `EidMrzData`

`documentType`, `documentTypeName`, `issuingState`, `documentNumber`,
`documentNumberValid`, `emiratesId` (`784-YYYY-NNNNNNN-C` or `null`), `surname`,
`givenNames`, `nationality`, `sex` (`'M' | 'F' | 'X'`), `dateOfBirth`,
`dateOfExpiry` (ISO `YYYY-MM-DD`), `dateOfBirthValid`, `dateOfExpiryValid`,
`optionalData1`, `optionalData2`, `compositeValid`, `mrzLines`.

---

## Files

```
eid-mrz-sdk/
├── index.ts                     barrel — import from here
├── package.json                 optional: publish as @eand/eid-mrz-sdk
├── README.md
└── src/
    ├── types.ts                 public types
    ├── check-digit.ts           ICAO 9303 7-3-1 arithmetic
    ├── parser.ts                parseMrz() — TD1 decoder
    ├── sample.ts                SAMPLE_MRZ (valid, synthetic)
    ├── reader.ts                EidMrzReader
    └── camera/
        ├── camera-scanner.ts    getUserMedia + overlay UI + scan loop
        ├── ocr.ts               lazy Tesseract.js engine
        ├── mrz-extract.ts       noisy OCR text → 3×30 TD1 candidate
        └── styles.ts            injected overlay CSS (e& theme)
```

## Performance

The default engine is Tesseract.js — a general-purpose OCR engine compiled to
WASM. It is the portable choice, not the fast one. A native MRZ SDK (ML Kit,
Regula, Microblink) runs a purpose-built model against the camera buffer with
hardware acceleration and will always beat it. Expect Tesseract to be usable,
not instant, on mid-range Android.

What the SDK does to keep it as quick as it can be:

| Lever | Effect |
| --- | --- |
| `preload()` | Fetches the model when your screen mounts, not on the first frame. **The single biggest win** — without it the first scan stalls on a multi-megabyte download. |
| `tessdata_fast` models by default | **1.9 MB instead of 10.7 MB**, and ~84ms vs ~141ms per frame. MRZ glyphs are a clean fixed-width subset, so the heavy models buy nothing. |
| LSTM-only engine, dictionaries off | An MRZ has no words; the DAWG passes are pure overhead. |
| Frame normalised to ~1000px | Enough for 25-40px glyphs; wider input multiplies cost for no accuracy gain. |
| `scanIntervalMs: 150` | The awaited OCR call is the real throttle, so the gap stays small. |
| Check digits used as a repair oracle | A dropped or hallucinated glyph shifts every later position and would waste the frame. Enumerating ~30 single-edit variants and keeping the one that verifies costs 0.17ms and rescues reads that would otherwise need another second of scanning. |
| Model cached in IndexedDB | Only the first ever scan pays the download. |

For production, **self-host the model** to cut a cross-origin round trip: copy
`eng.traineddata.gz` from `tessdata_fast` into your static assets and point at it —

```ts
new EidMrzReader({ camera: { langPath: '/assets/tessdata' } });
```

Measure on the real device before tuning — pass `camera.onFrame`:

```ts
new EidMrzReader({ camera: { onFrame: ({ ms, found }) => console.log(ms, found) } });
```

**If you need native speed**, keep this SDK for the UI and parsing and swap the
engine for whatever your app already has:

```ts
const reader = new EidMrzReader({
  camera: { ocr: { recognize: (canvas) => MyNativeBridge.readText(canvas.toDataURL()) } },
});
```

`parseMrz`, the check-digit logic and the TD1 repair heuristics are pure
functions — they cost microseconds and are worth reusing whatever reads the
pixels.

## Notes

- The SDK does not bundle Tesseract. The default engine injects
  `tesseract.js@5` from jsDelivr on first OCR; override with
  `camera.tesseractUrl` or replace `camera.ocr` entirely (e.g. behind a strict
  CSP, or to use a native reader).
- Call `reader.dispose()` when you are done to release the OCR worker. A reader
  may be scanned with repeatedly; the worker is created once and reused.
- TD1 check digits cover the document number, the dates and the composite — but
  **not** the name line, which no checksum protects. They are also mod-10, so a
  corrupted read slips through roughly one time in ten per digit. Treat `valid`
  as strong evidence, not proof, and keep the captured MRZ text visible so the
  holder's details can be eyeballed and corrected.
- `parseMrz` does no OCR — give it text. It tolerates lower case, spaces, missing
  newlines and a single unbroken 90-character string.
