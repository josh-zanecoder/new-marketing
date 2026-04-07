const US_PHONE_DIGITS = 10

function usPhoneDigits(input: string | number): string {
  const digits = String(input).replace(/\D/g, '')
  if (digits.length === US_PHONE_DIGITS + 1 && digits.startsWith('1')) {
    return digits.slice(1)
  }
  return digits
}

/**
 * Formats a value as a US phone number: (XXX) XXX-XXXX.
 * Strips non-digits; handles optional leading country code 1.
 */
export function formatUsPhoneNumber(
  input: string | number | null | undefined
): string {
  if (input == null || input === '') return ''
  const ten = usPhoneDigits(input)
  if (ten.length !== US_PHONE_DIGITS) return String(input).trim()
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`
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
