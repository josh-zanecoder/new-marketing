import {
  detectEmailResponsiveBreakpoint,
  DEFAULT_EMAIL_RESPONSIVE_BREAKPOINT,
  EMAIL_MAIL_VIEW,
  EMAIL_WEB_VIEW,
  EMAIL_MAIL_VIEW_MAX_WIDTH,
  EMAIL_MAIL_VIEW_MIN_WIDTH,
  EMAIL_WEB_VIEW_MAX_WIDTH,
  EMAIL_WEB_VIEW_MIN_WIDTH,
  isMobileMailLayout,
  isMobileWebLayout,
  mailViewLayoutLabel,
  webViewLayoutLabel,
  mailViewSliderMarks,
  webViewSliderMarks,
  resolveDesktopMailViewWidth,
  resolveDesktopWebViewWidth,
  resolveMailViewWidth,
  resolveWebViewWidth,
  resolveMobileMailViewWidth,
  resolveMobileWebViewWidth,
  type EmailMailViewMode,
  type EmailWebViewMode,
} from '@shared/utils/emailResponsiveWebView'

export {
  detectEmailResponsiveBreakpoint,
  detectEmailResponsiveBreakpoint as detectEmailMobileBreakpoint,
  DEFAULT_EMAIL_RESPONSIVE_BREAKPOINT,
  DEFAULT_EMAIL_RESPONSIVE_BREAKPOINT as RESPONSIVE_BREAKPOINT_HINT,
  EMAIL_MAIL_VIEW,
  EMAIL_WEB_VIEW,
  EMAIL_MAIL_VIEW_MAX_WIDTH,
  EMAIL_MAIL_VIEW_MIN_WIDTH,
  EMAIL_WEB_VIEW_MAX_WIDTH,
  EMAIL_WEB_VIEW_MIN_WIDTH,
  isMobileMailLayout,
  isMobileWebLayout,
  mailViewLayoutLabel,
  webViewLayoutLabel,
  mailViewSliderMarks,
  webViewSliderMarks,
  resolveDesktopMailViewWidth,
  resolveDesktopWebViewWidth,
  resolveMailViewWidth,
  resolveWebViewWidth,
  resolveMobileMailViewWidth,
  resolveMobileWebViewWidth,
  type EmailMailViewMode,
  type EmailWebViewMode,
}

export {
  prepareEmailHtmlForPreviewIframe,
  prepareMailViewPreviewHtml,
  prepareWebViewPreviewHtml,
  stripViewportMeta,
  createEmailPreviewBlobUrl,
  buildImportedEmailIframeDocument,
} from '@shared/utils/emailHtmlPreview'

import { prepareEmailHtmlForPreviewIframe, createEmailPreviewBlobUrl } from '@shared/utils/emailHtmlPreview'

export function injectPreviewViewport(html: string, previewWidth: number): string {
  return prepareEmailHtmlForPreviewIframe(html, previewWidth)
}

export function prepareCompiledEmailPreviewHtml(html: string, previewWidth: number): string {
  return prepareEmailHtmlForPreviewIframe(html, previewWidth)
}

export function responsiveLayoutLabel(previewWidth: number, html: string): string {
  return webViewLayoutLabel(previewWidth, html)
}

export function revokeEmailPreviewBlobUrl(url: string | null | undefined): void {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
