export {
  campaignEmailPreviewSrcdoc,
  prepareEmailHtmlForPreviewIframe,
  prepareMailViewPreviewHtml,
} from '~~/shared/utils/emailHtmlPreview'

export {
  EMAIL_MAIL_VIEW,
  EMAIL_WEB_VIEW,
  resolveMailViewWidth,
  resolveWebViewWidth,
  mailViewLayoutLabel,
  webViewLayoutLabel,
  detectEmailResponsiveBreakpoint,
  type EmailMailViewMode,
  type EmailWebViewMode,
} from '~~/shared/utils/emailResponsiveWebView'

export * from './campaignEmailWebView'
