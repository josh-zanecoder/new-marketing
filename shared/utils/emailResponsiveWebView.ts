/**
 * Email web-view widths — browser-accurate preview at mobile / desktop viewport sizes.
 * HTML == web view: iframe viewport matches Chrome / Edge device emulation.
 */

export const EMAIL_WEB_VIEW = {
  mobile: {
    /** Samsung Galaxy S8+ / common Chrome device emulation width (matches local HTML testing). */
    width: 360,
    label: 'Mobile web view',
    shortLabel: 'Mobile web',
  },
  desktop: {
    /** Desktop browser width (above common 780px Beefree breakpoint). */
    width: 820,
    label: 'Desktop web view',
    shortLabel: 'Desktop web',
  },
} as const

/** @deprecated Use EMAIL_WEB_VIEW */
export const EMAIL_MAIL_VIEW = EMAIL_WEB_VIEW

export type EmailWebViewMode = 'mobile' | 'desktop'

/** @deprecated Use EmailWebViewMode */
export type EmailMailViewMode = EmailWebViewMode

export const EMAIL_WEB_VIEW_MIN_WIDTH = 280
export const EMAIL_WEB_VIEW_MAX_WIDTH = 900

/** @deprecated Use EMAIL_WEB_VIEW_MIN_WIDTH */
export const EMAIL_MAIL_VIEW_MIN_WIDTH = EMAIL_WEB_VIEW_MIN_WIDTH

/** @deprecated Use EMAIL_WEB_VIEW_MAX_WIDTH */
export const EMAIL_MAIL_VIEW_MAX_WIDTH = EMAIL_WEB_VIEW_MAX_WIDTH

export const DEFAULT_EMAIL_RESPONSIVE_BREAKPOINT = 780

export function detectEmailResponsiveBreakpoint(html: string): number {
  let breakpoint = DEFAULT_EMAIL_RESPONSIVE_BREAKPOINT
  for (const match of html.matchAll(/@media[^{]*\(max-width:\s*(\d+(?:\.\d+)?)px\)/gi)) {
    const value = Math.round(Number.parseFloat(match[1] ?? ''))
    if (Number.isFinite(value) && value > 0) {
      breakpoint = Math.max(breakpoint, value)
    }
  }
  return breakpoint
}

export function resolveMobileWebViewWidth(): number {
  return EMAIL_WEB_VIEW.mobile.width
}

/** @deprecated Use resolveMobileWebViewWidth */
export const resolveMobileMailViewWidth = resolveMobileWebViewWidth

export function resolveDesktopWebViewWidth(html: string): number {
  const breakpoint = detectEmailResponsiveBreakpoint(html)
  return Math.max(EMAIL_WEB_VIEW.desktop.width, breakpoint + 20)
}

/** @deprecated Use resolveDesktopWebViewWidth */
export const resolveDesktopMailViewWidth = resolveDesktopWebViewWidth

export function resolveWebViewWidth(mode: EmailWebViewMode, html: string): number {
  return mode === 'mobile' ? resolveMobileWebViewWidth() : resolveDesktopWebViewWidth(html)
}

/** @deprecated Use resolveWebViewWidth */
export const resolveMailViewWidth = resolveWebViewWidth

export function isMobileWebLayout(previewWidth: number, html: string): boolean {
  return previewWidth <= detectEmailResponsiveBreakpoint(html)
}

/** @deprecated Use isMobileWebLayout */
export const isMobileMailLayout = isMobileWebLayout

export function webViewLayoutLabel(previewWidth: number, html: string): string {
  return isMobileWebLayout(previewWidth, html)
    ? EMAIL_WEB_VIEW.mobile.shortLabel
    : EMAIL_WEB_VIEW.desktop.shortLabel
}

/** @deprecated Use webViewLayoutLabel */
export const mailViewLayoutLabel = webViewLayoutLabel

export function webViewSliderMarks(html: string): Array<{ value: number; label: string }> {
  const mobile = resolveMobileWebViewWidth()
  const desktop = resolveDesktopWebViewWidth(html)
  return [
    { value: mobile, label: `${mobile}` },
    { value: desktop, label: `${desktop}` },
  ]
}

/** @deprecated Use webViewSliderMarks */
export const mailViewSliderMarks = webViewSliderMarks
