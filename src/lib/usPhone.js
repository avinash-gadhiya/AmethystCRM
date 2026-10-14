/**
 * Single source of truth for phone validation across the CRM.
 *
 * Every phone field in the app is a US number, so the same gate applies
 * everywhere: the balanced US phone regex below. It accepts the formats US
 * numbers are actually written in and rejects everything else, which is what
 * keeps foreign numbers out of the phone fields.
 *
 * Accepted:
 *   5551234567        555-123-4567     555.123.4567     555 123 4567
 *   (555)1234567      (555) 123-4567   (555).123.4567
 *   +1 555-123-4567   1-555-123-4567   +15551234567
 *
 * Rejected: anything with a non-US country code (+44, +91, ...), a digit count
 * other than 10 (or 11 starting with the US country code 1), or separators
 * outside `-`, `.` and space.
 */
export const US_PHONE_REGEX = /^(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;

export const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

/** The 10 national digits, with the optional US country code dropped. */
export const getUsNationalDigits = (value) => {
  const digits = normalizeDigits(value);
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return '';
};

export const isValidUsPhone = (value) => US_PHONE_REGEX.test(String(value || '').trim());

/**
 * Returns '' when valid, otherwise the reason.
 *
 * Beyond the regex, two checks reject strings that match the shape but can
 * never be dialed in the US - a real number is never turned away by either:
 *   - an area code starting with 0 or 1 (no US area code does)
 *   - the same digit ten times (0000000000), which is always a placeholder
 */
export const getUsPhoneError = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'is required';
  if (!US_PHONE_REGEX.test(raw)) return 'must be a valid US number, e.g. (555) 123-4567';

  const digits = getUsNationalDigits(raw);
  if (/^[01]/.test(digits)) return 'area code cannot start with 0 or 1';
  if (/^(\d)\1{9}$/.test(digits)) return 'cannot be the same digit repeated';

  return '';
};

/** Validation for a required phone field. Returns '' when valid. */
export const validateUsPhone = (value, label = 'Phone') => {
  const error = getUsPhoneError(value);
  return error ? `${label} ${error}` : '';
};

/** Validation for an optional phone field - blank passes. Returns '' when valid. */
export const validateOptionalUsPhone = (value, label = 'Phone') => {
  if (!String(value || '').trim()) return '';
  return validateUsPhone(value, label);
};

/** Progressive display format: 555123 -> "(555) 123". Safe to call on every keystroke. */
export const formatUsPhone = (value) => {
  const digitsRaw = normalizeDigits(value);
  if (!digitsRaw) return '';

  const digits = digitsRaw.length === 11 && digitsRaw.startsWith('1') ? digitsRaw.slice(1) : digitsRaw;
  const normalized = digits.slice(0, 10);
  const area = normalized.slice(0, 3);
  const exchange = normalized.slice(3, 6);
  const line = normalized.slice(6, 10);

  let out = '';
  if (area.length) out += `(${area}`;
  if (area.length === 3) out += ')';
  if (exchange.length) out += ` ${exchange}`;
  if (line.length) out += `-${line}`;
  return out;
};

export const stripUsCountryCode = (digitsRaw) => {
  const digits = String(digitsRaw || '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

/**
 * True when the entry is clearly not a US number, so a formatting mask must
 * leave it alone and let validation reject it. Masking such a value would drop
 * the country code and keep the first 10 digits, silently turning e.g.
 * "+44 20 7946 0958" into the perfectly valid-looking "(442) 079-4609".
 */
export const isForeignPhoneEntry = (value) => {
  const raw = String(value || '').trim();
  if (/^\+/.test(raw) && !/^\+1/.test(raw)) return true;
  return normalizeDigits(raw).length > 11;
};

/** Placeholder/maxLength shared by every phone input so they look alike. */
export const US_PHONE_PLACEHOLDER = '(555) 123-4567';
// Formatted US numbers are 14 chars, but the cap has to leave room for a pasted
// foreign number to arrive whole - clipping it mid-string would hide the very
// digits that prove it isn't a US number.
export const US_PHONE_MAX_LENGTH = 20;


