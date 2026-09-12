/**
 * Turn a noisy OCR dump into a clean TD1 candidate: three lines of 30 chars.
 *
 * Two problems have to be solved. First, *which* of the recognised lines are the
 * MRZ — the crop usually catches printed text too. We score every run of three
 * adjacent lines against the known shape of a TD1 zone and keep the best.
 * Second, OCR reliably confuses a handful of glyph pairs; because the TD1 layout
 * fixes which positions are digits and which are letters, those positions can be
 * repaired deterministically rather than guessed.
 */

import { parseMrz } from '../parser';

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

/** Keep only MRZ glyphs; map look-alike separators to the filler `<`. */
function cleanLine(line: string): string {
  return line
    .toUpperCase()
    .replace(/[«»‹›\[\](){}]/g, '<')
    .replace(/[KX]{2,}/g, (m) => '<'.repeat(m.length)) // long K/X runs are filler
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9<]/g, '');
}

/** Pad with `<` or trim to exactly 30 characters. */
function fit30(line: string): string {
  if (line.length >= 30) return line.slice(0, 30);
  return line + '<'.repeat(30 - line.length);
}

const isDigit = (ch: string | undefined): boolean => !!ch && ch >= '0' && ch <= '9';
const isAlpha = (ch: string | undefined): boolean => !!ch && ch >= 'A' && ch <= 'Z';

/** How strongly does this line look like TD1 line 1 (`II AAA <9 docnum> C <15>`)? */
function scoreLine1(line: string): number {
  let score = 0;
  if (line[0] === 'I') score += 10; // identity document
  else if (isAlpha(line[0])) score += 3;
  if (isAlpha(line[1]) || line[1] === '<') score += 2;
  for (let i = 2; i <= 4; i += 1) if (isAlpha(line[i])) score += 2; // issuing state
  if (isDigit(line[14])) score += 3; // document-number check digit
  return score;
}

/** TD1 line 2 is `YYMMDD C S YYMMDD C AAA <optional×11> C` — very digit-heavy. */
function scoreLine2(line: string): number {
  let score = 0;
  for (let i = 0; i <= 6; i += 1) if (isDigit(line[i])) score += 2; // DOB + check
  for (let i = 8; i <= 14; i += 1) if (isDigit(line[i])) score += 2; // expiry + check
  if (line[7] === 'M' || line[7] === 'F' || line[7] === '<') score += 4;
  for (let i = 15; i <= 17; i += 1) if (isAlpha(line[i])) score += 2; // nationality
  if (isDigit(line[29])) score += 3; // composite check digit
  return score;
}

/** TD1 line 3 is the name — letters and filler only, and it always has `<<`. */
function scoreLine3(line: string): number {
  const chars = line.split('');
  const alpha = chars.filter((c) => isAlpha(c) || c === '<').length;
  let score = (alpha / Math.max(1, chars.length)) * 16;
  if (line.includes('<<')) score += 6;
  return score;
}

/** Closeness to the required 30 characters, 0–10 per line. */
function lengthScore(line: string): number {
  return Math.max(0, 10 - Math.abs(line.length - 30) * 2);
}

function scoreTriple(trio: string[]): number {
  const [l1, l2, l3] = trio;
  return (
    lengthScore(l1) +
    lengthScore(l2) +
    lengthScore(l3) +
    scoreLine1(l1) +
    scoreLine2(l2) +
    scoreLine3(l3) +
    (trio.some((line) => line.includes('<')) ? 5 : 0)
  );
}

/**
 * If a fixed-width field is already mostly digits, the stray letters in it are
 * OCR slips rather than real data — coerce the whole run.
 */
function coerceNumericRun(line: string, from: number, to: number): string {
  const segment = line.slice(from, to + 1);
  const digits = (segment.match(/[0-9]/g) ?? []).length;
  if (digits / segment.length < 0.6) return line;
  return line.slice(0, from) + toDigits(segment) + line.slice(to + 1);
}

/** Repair TD1 line 1: `II AAA <docnum×9> C <optional×15>` */
function repairLine1(line: string): string {
  const p = fit30(line).split('');
  p[0] = toLetters(p[0]);
  for (let i = 2; i <= 4; i += 1) p[i] = toLetters(p[i]); // issuing state
  p[14] = toDigits(p[14]); // document-number check digit
  // On an Emirates ID the card number (5-13) and the 15-digit ID in the optional
  // field (15-29) are wholly numeric.
  return coerceNumericRun(coerceNumericRun(p.join(''), 5, 13), 15, 29);
}

/**
 * Repair TD1 line 2, whose layout is fixed:
 * `YYMMDD C S YYMMDD C AAA <<<<<<<<<<< C`
 * (positions 0-5, 6, 7, 8-13, 14, 15-17, 18-28, 29)
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

/** Line 3 is all name data — no digits belong here. */
function repairLine3(line: string): string {
  return fit30(toLetters(line));
}

/**
 * Candidate corrections for a line that did not come back at exactly 30 chars.
 *
 * A single dropped or hallucinated glyph shifts every position after it, so the
 * check digits fail and the whole frame is wasted. But those check digits are
 * also a free oracle: the corrected line is somewhere in a space of ~30
 * single-edit variants, and verifying one costs microseconds. So enumerate.
 */
function lineVariants(line: string): string[] {
  if (line.length === 30) return [line];
  const out: string[] = [];
  if (line.length > 30) {
    if (line.length === 31) {
      // OCR invented a glyph — try dropping each one.
      for (let i = 0; i < line.length; i += 1) out.push(line.slice(0, i) + line.slice(i + 1));
    }
    out.push(line.slice(0, 30));
    out.push(line.slice(line.length - 30));
  } else {
    if (line.length === 29) {
      // OCR swallowed a glyph — `<` is by far the likeliest casualty.
      for (let i = 0; i <= line.length; i += 1) out.push(line.slice(0, i) + '<' + line.slice(i));
    }
    out.push(line + '<'.repeat(30 - line.length));
  }
  return out.slice(0, 40);
}

/**
 * Scan OCR text for the MRZ band and return a normalised `\n`-joined TD1 string,
 * or `null` when nothing plausible is present.
 */
export function extractTd1(ocrText: string): string | null {
  const candidates = ocrText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length >= 18 && line.length <= 46);

  if (candidates.length < 3) return null;

  let best: string[] | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i + 3 <= candidates.length; i += 1) {
    const trio = candidates.slice(i, i + 3);
    const score = scoreTriple(trio);
    if (score > bestScore) {
      bestScore = score;
      best = trio;
    }
  }
  if (!best) return null;

  // A genuine TD1 zone scores ~120; a badly degraded one still clears 90. Printed
  // card text (the front of the card, headings, labels) tops out around 50, so
  // this threshold keeps false positives out of the automatic scan loop.
  if (bestScore < 70) return null;

  const [l1, l2, l3] = best;
  const l1Variants = lineVariants(l1).map(repairLine1);
  const l2Variants = lineVariants(l2).map(repairLine2);
  // Line 3 carries the name and no check digit, so there is nothing to search on.
  const line3 = repairLine3(l3);

  // Only worth searching when a length was off; the common case is a single pair.
  if (l1Variants.length > 1 || l2Variants.length > 1) {
    for (const a of l1Variants) {
      for (const b of l2Variants) {
        const candidate = [a, b, line3].join('\n');
        if (parseMrz(candidate).valid) return candidate;
      }
    }
  }

  return [l1Variants[0], l2Variants[0], line3].join('\n');
}
