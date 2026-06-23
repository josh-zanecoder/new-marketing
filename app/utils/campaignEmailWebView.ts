export {
  campaignEmailPreviewSrcdoc as campaignEmailWebViewHtml,
  prepareEmailHtmlForPreviewIframe,
  prepareMailViewPreviewHtml as prepareWebViewPreviewHtml,
  createEmailPreviewBlobUrl,
} from '~~/shared/utils/emailHtmlPreview'

export {
  EMAIL_WEB_VIEW,
  EMAIL_MAIL_VIEW,
  resolveWebViewWidth,
  resolveMailViewWidth,
  webViewLayoutLabel,
  mailViewLayoutLabel,
  detectEmailResponsiveBreakpoint,
  type EmailWebViewMode,
  type EmailMailViewMode,
} from '~~/shared/utils/emailResponsiveWebView'
