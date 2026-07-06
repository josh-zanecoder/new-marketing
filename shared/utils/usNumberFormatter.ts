const US_PHONE_DIGITS = 10

export function usPhoneDigits(input: string | number): string {
  const digits = String(input).replace(/\D/g, '')
  if (digits.length === US_PHONE_DIGITS + 1 && digits.startsWith('1')) {
    return digits.slice(1)
  }
  return digits
}

/**
 * Progressive US phone mask for text inputs: (XXX) XXX-XXXX.
 * Strips non-digits and blocks alphabetic input by ignoring them.
 */
export function formatUsPhoneInput(input: string): string {
  const digits = usPhoneDigits(input).slice(0, US_PHONE_DIGITS)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Returns true for digit keys and standard editing/navigation keys. */
export function isUsPhoneInputKeyAllowed(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true
  const { key } = event
  if (
    key === 'Backspace' ||
    key === 'Delete' ||
    key === 'Tab' ||
    key === 'Escape' ||
    key === 'Enter' ||
    key === 'Home' ||
    key === 'End'
  ) {
    return true
  }
  if (key.startsWith('Arrow')) return true
  return /^\d$/.test(key)
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
