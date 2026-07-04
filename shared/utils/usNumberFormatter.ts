const US_PHONE_DIGITS = 10
const US_PHONE_INPUT_CHARS = /[^\d+\-().\s]/g
const NON_DIGIT_RE = /\D/g

/** Digits-only extraction for live phone inputs; capped at 10 (no +1 country-code normalization). */
export function extractPhoneDigitsForInput(input: string): string {
  return String(input).replace(NON_DIGIT_RE, '').slice(0, US_PHONE_DIGITS)
}

/** Keeps only digits and common US phone punctuation (+, -, parentheses, spaces). */
export function sanitizePhoneInput(input: string): string {
  return String(input).replace(US_PHONE_INPUT_CHARS, '')
}

function formatTenUsPhoneDigits(digits: string): string {
  const area = digits.slice(0, 3)
  const prefix = digits.slice(3, 6)
  const line = digits.slice(6)

  if (digits.length < 3) return `(${area}`
  if (digits.length === 3) return `(${area})`
  if (digits.length <= 6) return `(${area})-${prefix}`
  return `(${area})-${prefix}-${line}`
}

function caretAfterPhoneDigits(formatted: string, digitCount: number): number {
  if (!digitCount) return 0
  let count = 0
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]!)) {
      count++
      if (count >= digitCount) return i + 1
    }
  }
  return formatted.length
}

/**
 * Progressive US phone mask while typing: (XXX)-XXX-XXXX.
 * Non-digits are stripped; formatting punctuation is inserted automatically.
 */
export function formatUsPhoneInputLive(input: string): string {
  return formatTenUsPhoneDigits(extractPhoneDigitsForInput(input))
}

/** Formats raw input and preserves caret position after digit-based masking. */
export function applyUsPhoneInputLive(
  raw: string,
  cursorBefore: number
): { formatted: string; caret: number } {
  const digitsBeforeCursor = extractPhoneDigitsForInput(raw.slice(0, cursorBefore)).length
  const formatted = formatUsPhoneInputLive(raw)
  const rejectedExtraDigit = String(raw).replace(NON_DIGIT_RE, '').length > US_PHONE_DIGITS
  const caret = rejectedExtraDigit
    ? formatted.length
    : caretAfterPhoneDigits(formatted, digitsBeforeCursor)
  return { formatted, caret }
}

export function usPhoneDigits(input: string | number): string {
  const digits = String(input).replace(NON_DIGIT_RE, '')
  if (digits.length === US_PHONE_DIGITS + 1 && digits.startsWith('1')) {
    return digits.slice(1)
  }
  return digits
}

/**
 * Formats a value as a US phone number: (XXX)-XXX-XXXX.
 * Strips non-digits; drops a leading +1 / 1 country code when present.
 */
export function formatUsPhoneNumber(
  input: string | number | null | undefined
): string {
  if (input == null || input === '') return ''
  const ten = usPhoneDigits(input)
  if (ten.length !== US_PHONE_DIGITS) return String(input).trim()
  return formatTenUsPhoneDigits(ten)
}

/**
 * Formats a number with US grouping (e.g. 1,234.56) via `en-US` locale.
 */
export function formatUsNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat('en-US', options).format(value)
}
