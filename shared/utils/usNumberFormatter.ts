const US_PHONE_DIGITS = 10
const US_PHONE_INPUT_CHARS = /[^\d+\-().\s]/g

/** Digits-only extraction for live phone inputs; capped at 10 (no +1 country-code normalization). */
export function extractPhoneDigitsForInput(input: string): string {
  return String(input).replace(/\D/g, '').slice(0, US_PHONE_DIGITS)
}

/** Keeps only digits and common US phone punctuation (+, -, parentheses, spaces). */
export function sanitizePhoneInput(input: string): string {
  return String(input).replace(US_PHONE_INPUT_CHARS, '')
}

/**
 * Progressive US phone mask while typing: (XXX)-XXX-XXXX.
 * Non-digits are stripped; formatting punctuation is inserted automatically.
 */
export function formatUsPhoneInputLive(input: string): string {
  const digits = extractPhoneDigitsForInput(input)
  if (!digits.length) return ''

  const area = digits.slice(0, 3)
  const prefix = digits.slice(3, 6)
  const line = digits.slice(6)

  if (digits.length < 3) return `(${area}`
  if (digits.length === 3) return `(${area})`
  if (digits.length <= 6) return `(${area})-${prefix}`
  return `(${area})-${prefix}-${line}`
}

export function usPhoneDigits(input: string | number): string {
  const digits = String(input).replace(/\D/g, '')
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
  return `(${ten.slice(0, 3)})-${ten.slice(3, 6)}-${ten.slice(6)}`
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
