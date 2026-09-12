/**
 * Turn a noisy OCR dump into a clean TD1 candidate: three lines of 30 chars.
 *
 * OCR of an MRZ reliably confuses a handful of glyph pairs. The MRZ layout tells
 * us which positions must be digits and which must be letters, so we can repair
 * those positions deterministically instead of guessing.
 */

const LETTER_TO_DIGIT: Record<string, string> = {
  O: '0', Q: '0', D: '0', U: '0',
  I: '1', L: '1', T: '1',
  Z: '2',
  E: '3',
  A: '4',
  S: '5',
  G: '6', C: '6',
  B: '8',
};

const DIGIT_TO_LETTER: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '5': 'S',
  '8': 'B',
};

function toDigits(segment: string): string {
  return segment.replace(/[A-Z]/g, (ch) => LETTER_TO_DIGIT[ch] ?? ch);
}

function toLetters(segment: string): string {
  return segment.replace(/[0-9]/g, (ch) => DIGIT_TO_LETTER[ch] ?? ch);
}

/** Keep only MRZ glyphs; map common separators to the filler `<`. */
function cleanLine(line: string): string {
  return line
    .toUpperCase()
    .replace(/[«»‹›\[\](){}]/g, '<')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9<]/g, '');
}

/** Pad with `<` or trim to exactly 30 characters. */
function fit30(line: string): string {
  if (line.length >= 30) return line.slice(0, 30);
  return line + '<'.repeat(30 - line.length);
}

/**
 * Repair TD1 line 2, whose layout is fixed:
 * `YYMMDD C YYMMDD C AAA <<<<<<<<<<< C`  (positions 0-5, 6, 7, 8-13, 14, 15-17, 18-28, 29)
 */
function repairLine2(line: string): string {
  const p = fit30(line).split('');
  for (let i = 0; i <= 6; i += 1) p[i] = toDigits(p[i]); // DOB + check
  // p[7] is sex — leave as a letter (M/F/X/<)
  for (let i = 8; i <= 14; i += 1) p[i] = toDigits(p[i]); // expiry + check
  for (let i = 15; i <= 17; i += 1) p[i] = toLetters(p[i]); // nationality
  p[29] = toDigits(p[29]); // composite check
  return p.join('');
}

/** Repair TD1 line 1: `II AAA <docnum×9> C <optional×15>` */
function repairLine1(line: string): string {
  const p = fit30(line).split('');
  p[0] = toLetters(p[0]);
  for (let i = 2; i <= 4; i += 1) p[i] = toLetters(p[i]); // issuing state
  p[14] = toDigits(p[14]); // document-number check digit
  return p.join('');
}

/** Line 3 is all name data — no digits belong here. */
function repairLine3(line: string): string {
  return fit30(toLetters(line));
}

/**
 * Scan OCR text for the MRZ band and return a normalised `\n`-joined TD1 string,
 * or `null` when nothing plausible is present.
 */
export function extractTd1(ocrText: string): string | null {
  const candidates = ocrText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length >= 20 && line.length <= 44)
    // A real MRZ line is dominated by A-Z, 0-9 and `<`.
    .filter((line) => (line.match(/[A-Z0-9<]/g)?.length ?? 0) / line.length > 0.9);

  if (candidates.length < 3) return null;

  // The MRZ is the last run of 3 lines that has at least one `<` (fillers are
  // near-universal in a TD1 zone).
  let group: string[] | null = null;
  for (let i = candidates.length - 3; i >= 0; i -= 1) {
    const trio = candidates.slice(i, i + 3);
    if (trio.some((line) => line.includes('<'))) {
      group = trio;
      break;
    }
  }
  if (!group) group = candidates.slice(-3);

  const [l1, l2, l3] = group;
  return [repairLine1(l1), repairLine2(l2), repairLine3(l3)].join('\n');
}
