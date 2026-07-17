/** Font families offered in the Custom Marketing TipTap toolbar (email-safe stacks). */
export const CUSTOM_MARKETING_FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Arial Black', value: '"Arial Black", Gadget, sans-serif' },
  { label: 'Arial Narrow', value: '"Arial Narrow", Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Helvetica Neue', value: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", Helvetica, sans-serif' },
  { label: 'Geneva', value: 'Geneva, Verdana, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Candara, Segoe, "Segoe UI", Optima, Arial, sans-serif' },
  { label: 'Candara', value: 'Candara, Calibri, Segoe, "Segoe UI", Optima, Arial, sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
  { label: 'Optima', value: 'Optima, Segoe, "Segoe UI", Candara, Calibri, Arial, sans-serif' },
  { label: 'Franklin Gothic', value: '"Franklin Gothic Medium", "Arial Narrow", Arial, sans-serif' },
  { label: 'Gill Sans', value: '"Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", sans-serif' },
  { label: 'Century Gothic', value: '"Century Gothic", CenturyGothic, AppleGothic, sans-serif' },
  { label: 'Futura', value: 'Futura, "Trebuchet MS", Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Times', value: 'Times, "Times New Roman", serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, "Book Antiqua", serif' },
  { label: 'Book Antiqua', value: '"Book Antiqua", Palatino, "Palatino Linotype", serif' },
  { label: 'Garamond', value: 'Garamond, "Times New Roman", serif' },
  { label: 'Baskerville', value: 'Baskerville, "Baskerville Old Face", "Hoefler Text", Garamond, "Times New Roman", serif' },
  { label: 'Cambria', value: 'Cambria, Georgia, serif' },
  { label: 'Constantia', value: 'Constantia, "Lucida Bright", Lucidabright, "Lucida Serif", Lucida, Georgia, serif' },
  { label: 'Didot', value: 'Didot, "Bodoni MT", "Noto Serif", Garamond, "Times New Roman", serif' },
  { label: 'Hoefler Text', value: '"Hoefler Text", "Baskerville Old Face", Garamond, "Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Courier', value: 'Courier, "Courier New", monospace' },
  { label: 'Lucida Console', value: '"Lucida Console", Monaco, monospace' },
  { label: 'Monaco', value: 'Monaco, "Lucida Console", monospace' },
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
  { label: 'Menlo', value: 'Menlo, Monaco, Consolas, "Courier New", monospace' },
  { label: 'Comic Sans MS', value: '"Comic Sans MS", "Comic Sans", cursive' },
  { label: 'Brush Script MT', value: '"Brush Script MT", cursive' },
  { label: 'Papyrus', value: 'Papyrus, fantasy' },
  { label: 'Impact', value: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
  { label: 'Copperplate', value: 'Copperplate, "Copperplate Gothic Light", fantasy' },
  { label: 'Lucida Handwriting', value: '"Lucida Handwriting", "Comic Sans MS", cursive' }
] as const

/** Font sizes offered in the Custom Marketing TipTap toolbar. */
export const CUSTOM_MARKETING_FONT_SIZES = [
  { label: '8', value: '8px' },
  { label: '9', value: '9px' },
  { label: '10', value: '10px' },
  { label: '11', value: '11px' },
  { label: '12', value: '12px' },
  { label: '13', value: '13px' },
  { label: '14', value: '14px' },
  { label: '15', value: '15px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '22', value: '22px' },
  { label: '24', value: '24px' },
  { label: '26', value: '26px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
  { label: '36', value: '36px' },
  { label: '40', value: '40px' },
  { label: '48', value: '48px' },
  { label: '56', value: '56px' },
  { label: '64', value: '64px' },
  { label: '72', value: '72px' }
] as const

export const CUSTOM_MARKETING_DEFAULT_FONT_FAMILY = CUSTOM_MARKETING_FONT_FAMILIES[0].value
export const CUSTOM_MARKETING_DEFAULT_FONT_SIZE = '14px'
export const CUSTOM_MARKETING_DEFAULT_TEXT_COLOR = '#222222'

/** Quick image width presets (px). `null` = full width / clear fixed size. */
export const CUSTOM_MARKETING_IMAGE_WIDTH_PRESETS = [
  { label: 'S', value: 200, title: 'Small (200px wide)' },
  { label: 'M', value: 360, title: 'Medium (360px wide)' },
  { label: 'L', value: 520, title: 'Large (520px wide)' },
  { label: 'Full', value: null, title: 'Full width' }
] as const

export type CustomMarketingImageWidthPreset = (typeof CUSTOM_MARKETING_IMAGE_WIDTH_PRESETS)[number]['value']

export type CustomMarketingTextStyleAttrs = {
  fontFamily: string
  fontSize: string
  color: string
}

/** True when TipTap textStyle attrs already match the toolbar values. */
export function textStyleAttrsMatch(
  existing: { fontFamily?: unknown; fontSize?: unknown; color?: unknown },
  next: CustomMarketingTextStyleAttrs
): boolean {
  return existing.fontFamily === next.fontFamily
    && existing.fontSize === next.fontSize
    && existing.color === next.color
}

/** Max pasted/uploaded source image size (bytes) before compression. */
export { CUSTOM_MARKETING_MAX_IMAGE_BYTES } from './customMarketingEmailSize'

export function isAllowedCustomMarketingImageMime(mime: string): boolean {
  const type = String(mime ?? '').toLowerCase()
  return type === 'image/png' || type === 'image/jpeg' || type === 'image/jpg' || type === 'image/gif' || type === 'image/webp'
}

/** Avatar initials for the inbox-style From header. */
export function customMarketingSenderInitials(name: string, email: string): string {
  const trimmedName = String(name ?? '').trim()
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      const first = parts[0]?.[0] ?? ''
      const second = parts[1]?.[0] ?? ''
      return `${first}${second}`.toUpperCase()
    }
    return trimmedName.slice(0, 2).toUpperCase()
  }
  const trimmedEmail = String(email ?? '').trim()
  return trimmedEmail ? trimmedEmail.slice(0, 2).toUpperCase() : '?'
}

/** Gmail-like relative time label for the compose preview header. */
export function customMarketingInboxDateLabel(now: Date = new Date()): string {
  const hours = now.getHours()
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const hour12 = hours % 12 || 12
  const ampm = hours >= 12 ? 'PM' : 'AM'
  return `Today, ${hour12}:${minutes} ${ampm}`
}

/** Fake Gmail inbox URL shown in the browser-preview address bar. */
export function customMarketingBrowserAddressUrl(subject: string): string {
  const slug = String(subject ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const path = slug || 'preview'
  return `https://mail.google.com/mail/u/0/#inbox/${path}`
}
