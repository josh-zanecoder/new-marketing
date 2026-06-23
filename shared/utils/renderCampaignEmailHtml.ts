import { mergeMustacheTemplate } from './emailTemplateMerge'
import {
  ensureFullEmailHtmlDocument,
  resolveEmailTemplateHtml
} from './emailEditorHtml'

/**
 * Resolve the stored template into a full HTML document and merge mustache tags.
 *
 * The server is responsible for inlining CSS (see `server/utils/email/inlineEmailCss`)
 * before sending, so this keeps the full document intact without rewriting it.
 */
export function renderCampaignEmailHtmlForSend(
  templateHtml: string,
  mergeRoot: Record<string, unknown>
): string {
  const resolved = resolveEmailTemplateHtml({ htmlTemplate: templateHtml })
  if (!resolved.trim()) return ''
  const merged = mergeMustacheTemplate(resolved, mergeRoot)
  if (!merged.trim()) return merged
  return ensureFullEmailHtmlDocument(merged)
}