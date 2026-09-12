/**
 * ICAO 9303 check-digit arithmetic. Weights repeat 7, 3, 1; letters map
 * A→10 … Z→35; the filler `<` is 0; the result is the running sum mod 10.
 */

const WEIGHTS = [7, 3, 1];

/** Numeric value of a single MRZ character, or -1 when it is not permitted. */
export function charValue(ch: string): number {
  if (ch === '<') return 0;
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48; // '0' → 0
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55; // 'A' → 10
  return -1;
}

/** Compute the check digit for `input`, or -1 when it contains an illegal char. */
export function computeCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) {
    const value = charValue(input[i]);
    if (value < 0) return -1;
    sum += value * WEIGHTS[i % WEIGHTS.length];
  }
  return sum % 10;
}

/** True when `expected` is a single digit equal to the computed check digit. */
export function verifyCheckDigit(input: string, expected: string): boolean {
  if (!/^[0-9]$/.test(expected)) return false;
  return computeCheckDigit(input) === Number(expected);
}
