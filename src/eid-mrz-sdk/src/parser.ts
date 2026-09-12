/**
 * Pure parser for the Emirates ID machine-readable zone.
 *
 * The Emirates ID card carries an ICAO 9303 **TD1** zone: three lines of exactly
 * 30 characters. This module turns that text into {@link EidMrzData} and reports
 * every check-digit result. It has no side effects and no dependencies.
 */

import { verifyCheckDigit } from './check-digit';
import type { EidMrzData, EidMrzResult, Sex } from './types';

const LINE_LENGTH = 30;
const MONTHS_MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Split into lines, upper-case, drop spaces, keep only non-empty lines. */
function normalizeLines(input: string): string[] {
  return input
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.toUpperCase().replace(/[^A-Z0-9<]/g, ''))
    .filter((line) => line.length > 0);
}

/** Remove filler `<`, collapse internal runs to single spaces, trim. */
function stripFiller(value: string): string {
  return value.replace(/</g, ' ').replace(/\s+/g, ' ').trim();
}

function documentTypeName(code: string): string {
  if (code.startsWith('I')) return 'Identity card';
  if (code.startsWith('P')) return 'Passport';
  return code || 'Unknown';
}

function normalizeSex(raw: string): Sex {
  if (raw === 'M') return 'M';
  if (raw === 'F') return 'F';
  return 'X';
}

/** Expand a 2-digit MRZ year. Births resolve to the past; expiries to a window. */
function expandYear(yy: number, mode: 'birth' | 'expiry'): number {
  const nowYY = new Date().getFullYear() % 100;
  if (mode === 'birth') {
    return yy > nowYY ? 1900 + yy : 2000 + yy;
  }
  // Expiry: assume within roughly [-30, +70] years of "now".
  return yy > (nowYY + 70) % 100 ? 1900 + yy : 2000 + yy;
}

/** `YYMMDD` → ISO `YYYY-MM-DD`; returns `''` when not a plausible date. */
function toIsoDate(yymmdd: string, mode: 'birth' | 'expiry'): string {
  if (!/^\d{6}$/.test(yymmdd)) return '';
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  const dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12) return '';
  if (dd < 1 || dd > MONTHS_MAX_DAY[mm - 1]) return '';
  const yyyy = expandYear(yy, mode);
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** Pull a 15-digit Emirates ID out of an optional-data field and format it. */
function extractEmiratesId(optionalData: string): string | null {
  const digits = optionalData.replace(/[^0-9]/g, '');
  if (digits.length !== 15) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
}

/** TD1 line 3 holds `PRIMARY<<SECONDARY` with `<` as the space separator. */
function parseName(line: string): { surname: string; givenNames: string } {
  const [primary = '', secondary = ''] = line.split('<<');
  return {
    surname: stripFiller(primary) || '—',
    givenNames: stripFiller(secondary) || '—',
  };
}

/**
 * Parse a raw Emirates ID MRZ string (TD1, 3 × 30). Whitespace, lower case and
 * missing newlines are tolerated. Structural failures populate `errors` and
 * leave `data` null; failed check digits populate `warnings` but still return
 * decoded `data`.
 */
export function parseMrz(raw: string): EidMrzResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { success: false, valid: false, data: null, errors: ['MRZ text is empty.'], warnings };
  }

  let lines = normalizeLines(raw);

  // Tolerate a single unbroken 90-character string.
  if (lines.length === 1 && lines[0].length === LINE_LENGTH * 3) {
    lines = [lines[0].slice(0, 30), lines[0].slice(30, 60), lines[0].slice(60, 90)];
  }

  if (lines.length !== 3) {
    errors.push(`Expected 3 MRZ lines (TD1 format), found ${lines.length}.`);
    return { success: false, valid: false, data: null, errors, warnings };
  }
  if (lines.some((line) => line.length !== LINE_LENGTH)) {
    const lengths = lines.map((line) => line.length).join(', ');
    errors.push(`Each TD1 MRZ line must be exactly 30 characters (got ${lengths}).`);
    return { success: false, valid: false, data: null, errors, warnings };
  }

  const [l1, l2, l3] = lines as [string, string, string];

  // ---- Line 1: document code, issuing state, document number, optional data 1
  const documentType = stripFiller(l1.slice(0, 2));
  const issuingState = stripFiller(l1.slice(2, 5));
  const documentNumberRaw = l1.slice(5, 14);
  const documentNumberCheck = l1.slice(14, 15);
  const optionalData1 = l1.slice(15, 30);

  // ---- Line 2: DOB, sex, expiry, nationality, optional data 2, composite
  const dobRaw = l2.slice(0, 6);
  const dobCheck = l2.slice(6, 7);
  const sexRaw = l2.slice(7, 8);
  const expiryRaw = l2.slice(8, 14);
  const expiryCheck = l2.slice(14, 15);
  const nationality = stripFiller(l2.slice(15, 18));
  const optionalData2 = l2.slice(18, 29);
  const compositeCheck = l2.slice(29, 30);

  const documentNumberValid = verifyCheckDigit(documentNumberRaw, documentNumberCheck);
  if (!documentNumberValid) warnings.push('Document number check digit does not match.');

  const dateOfBirthValid = verifyCheckDigit(dobRaw, dobCheck);
  if (!dateOfBirthValid) warnings.push('Date of birth check digit does not match.');

  const dateOfExpiryValid = verifyCheckDigit(expiryRaw, expiryCheck);
  if (!dateOfExpiryValid) warnings.push('Date of expiry check digit does not match.');

  const compositeInput =
    l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  const compositeValid = verifyCheckDigit(compositeInput, compositeCheck);
  if (!compositeValid) warnings.push('Composite check digit does not match.');

  const dateOfBirth = toIsoDate(dobRaw, 'birth');
  if (!dateOfBirth) warnings.push('Date of birth is not a valid calendar date.');
  const dateOfExpiry = toIsoDate(expiryRaw, 'expiry');
  if (!dateOfExpiry) warnings.push('Date of expiry is not a valid calendar date.');

  const { surname, givenNames } = parseName(l3);

  const data: EidMrzData = {
    documentType: documentType || '—',
    documentTypeName: documentTypeName(documentType),
    issuingState: issuingState || '—',
    documentNumber: stripFiller(documentNumberRaw) || '—',
    documentNumberValid,
    emiratesId: extractEmiratesId(optionalData1),
    surname,
    givenNames,
    nationality: nationality || '—',
    sex: normalizeSex(sexRaw),
    dateOfBirth,
    dateOfBirthValid,
    dateOfExpiry,
    dateOfExpiryValid,
    optionalData1: stripFiller(optionalData1),
    optionalData2: stripFiller(optionalData2),
    compositeValid,
    mrzLines: [l1, l2, l3],
  };

  return {
    success: true,
    valid:
      documentNumberValid &&
      dateOfBirthValid &&
      dateOfExpiryValid &&
      compositeValid,
    data,
    errors,
    warnings,
  };
}
