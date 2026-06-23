const US_PHONE_DIGITS = 10

const US_PHONE_NUMERIC_ALLOWED_KEYS = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'] as const

function usPhoneDigits(input: string | number): string {
  const digits = String(input).replace(/\D/g, '')
  if (digits.length === US_PHONE_DIGITS + 1 && digits.startsWith('1')) {
    return digits.slice(1)
  }
  return digits
}

/** Digits only (10-digit US local number when complete). */
export function sanitizeUsPhoneNumber(input: string): string {
  return usPhoneDigits(input ?? '').slice(0, US_PHONE_DIGITS)
}

/** True when empty (optional field) or exactly 10 US digits. */
export function isValidUsPhone(phone: string): boolean {
  const digits = sanitizeUsPhoneNumber(phone ?? '')
  return digits.length === 0 || digits.length === US_PHONE_DIGITS
}

/** Format as the user types: (XXX) XXX-XXXX */
export function formatUsPhoneInput(value: string): string {
  const digits = sanitizeUsPhoneNumber(value)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/** Restrict phone inputs to digits and standard editing keys. */
export function handleUsPhoneKeydown(event: KeyboardEvent): void {
  if (/[\d]/.test(event.key)) return
  if (US_PHONE_NUMERIC_ALLOWED_KEYS.includes(event.key as (typeof US_PHONE_NUMERIC_ALLOWED_KEYS)[number])) {
    return
  }
  if (event.ctrlKey || event.metaKey) return
  event.preventDefault()
}

export const usPhone = {
  formatInput: formatUsPhoneInput,
  toSave: sanitizeUsPhoneNumber,
  toDisplay: formatUsPhoneInput,
  onKeydown: handleUsPhoneKeydown,
  isValid: isValidUsPhone
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
