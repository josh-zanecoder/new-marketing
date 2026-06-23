import {
  containsMergeTags,
  plainTextToInlineHtml,
  normalizeMergeTagAttributeHtml,
} from './mergeTagText';
import { htmlInlineToTextBlockProps } from './htmlInlineToTextBlock';

export type ImportedBlockContentProps = {
  text?: string;
  contentHtml?: string;
  markdown?: boolean;
};

/** Normalize paragraph/heading inner HTML while keeping inline formatting. */
export function normalizeImportedInlineHtml(html: string): string {
  return normalizeMergeTagAttributeHtml(html)
    .replace(/^\s*<p[^>]*>/i, '')
    .replace(/<\/p>\s*$/i, '')
    .trim();
}

export function hasRichInlineFormatting(html: string): boolean {
  const normalized = normalizeImportedInlineHtml(html);
  return /<(strong|b|em|i|u|span|a|br)\b/i.test(normalized) || /<br\s*\/?>/i.test(normalized);
}

export function inlineHtmlToPlainFallback(html: string): string {
  return normalizeImportedInlineHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(strong|b|em|i|u|span)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Beefree paragraph blocks use one outer <p>. Block tags inside content (e.g. user types
 * `<p>click here</p>`) must become inline markup or the browser splits the DOM and stale
 * orphan paragraphs accumulate on every keystroke.
 */
export function sanitizeInlineHtmlForParagraphPatch(html: string): string {
  let out = normalizeMergeTagAttributeHtml(html);
  out = out.replace(/<\/p>\s*<p[^>]*>/gi, '<br>');
  out = out.replace(/<\/p>/gi, '<br>');
  out = out.replace(/<p[^>]*>/gi, '');
  out = out.replace(/<\/div>\s*<div[^>]*>/gi, '<br>');
  out = out.replace(/<\/div>/gi, '<br>');
  out = out.replace(/<div[^>]*>/gi, '');
  out = out.replace(/(<br\s*\/?>\s*){2,}/gi, '<br>');
  out = out.replace(/^(<br\s*\/?>\s*)+|(<br\s*\/?>\s*)+$/gi, '');
  return out.trim();
}

export function resolveBlockInnerHtml(props: ImportedBlockContentProps | undefined | null): string {
  if (!props) return '';
  const html = props.contentHtml?.trim();
  const text = props.text?.trim() ?? '';

  if (!html) return plainTextToInlineHtml(text);

  // Plain text / merge tags only — avoid DOM innerHTML round-trip for tokens.
  if (!hasRichInlineFormatting(html)) {
    return plainTextToInlineHtml(html);
  }

  let resolved = html;
  if (text && containsMergeTags(text)) {
    for (const match of text.matchAll(/\{\{[^}]+\}\}/g)) {
      const token = match[0];
      if (!resolved.includes(token)) {
        resolved += token;
      }
    }
  }
  return sanitizeInlineHtmlForParagraphPatch(resolved);
}

/** Build Text/Heading props from imported inline HTML (preserves bold, spans, fonts). */
export function buildImportedContentProps(sourceHtml: string): ImportedBlockContentProps {
  const normalized = normalizeImportedInlineHtml(sourceHtml);
  if (!normalized) return { text: '' };

  if (hasRichInlineFormatting(normalized)) {
    return {
      text: inlineHtmlToPlainFallback(normalized),
      contentHtml: normalized,
      markdown: false,
    };
  }

  if (containsMergeTags(normalized)) {
    const plain = inlineHtmlToPlainFallback(normalized) || normalized.replace(/<[^>]+>/g, '').trim();
    return { text: plain, markdown: false };
  }

  const textProps = htmlInlineToTextBlockProps(sourceHtml);
  if (textProps) return textProps;
  return { text: inlineHtmlToPlainFallback(normalized), markdown: false };
}

export function getImportedBlockEditorContent(props: ImportedBlockContentProps | undefined | null): string {
  return props?.contentHtml?.trim() || props?.text?.trim() || '';
}

/** True when the token appears outside href/src attributes (visible content). */
export function isMergeTokenVisibleInContent(content: string, token: string): boolean {
  const withoutAttrs = content.replace(/\b(?:href|src)=["'][^"']*["']/gi, '');
  return withoutAttrs.includes(token);
}

function appendMergeTokenToHtml(html: string, token: string): string {
  const keyMatch = token.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  const plain = html.replace(/<[^>]+>/g, '').trim();
  if (keyMatch && /Click here\s*$/i.test(plain)) {
    const key = keyMatch[1].trim();
    return html.replace(/(Click here)\s*$/i, `<a href="{{${key}}}">$1</a>`);
  }
  return `${html}${token}`;
}

export function insertMergeTagIntoBlockContent(
  props: ImportedBlockContentProps | undefined,
  token: string
): ImportedBlockContentProps {
  const trimmedToken = token.trim();
  if (!trimmedToken) return props ?? {};

  const html = props?.contentHtml?.trim();
  if (html && hasRichInlineFormatting(html)) {
    const nextHtml = isMergeTokenVisibleInContent(html, trimmedToken)
      ? html
      : appendMergeTokenToHtml(html, trimmedToken);
    return {
      ...props,
      contentHtml: nextHtml,
      text: inlineHtmlToPlainFallback(nextHtml),
      markdown: false,
    };
  }

  const baseText = props?.text?.trim() ?? props?.contentHtml?.trim() ?? '';
  if (/unsubscribe/i.test(trimmedToken) && /Click here\s*$/i.test(baseText)) {
    const linked = `${baseText.replace(/\s*$/, '')}`.replace(
      /Click here\s*$/i,
      '<a href="{{unsubscribe}}">Click here</a>'
    );
    return {
      ...props,
      text: inlineHtmlToPlainFallback(linked),
      contentHtml: linked,
      markdown: false,
    };
  }
  const nextText = isMergeTokenVisibleInContent(baseText, trimmedToken)
    ? baseText
    : `${baseText}${trimmedToken}`;
  return {
    ...props,
    text: nextText,
    contentHtml: undefined,
    markdown: false,
  };
}

export function patchImportedBlockContentProps(
  existing: ImportedBlockContentProps | undefined,
  nextValue: string
): ImportedBlockContentProps {
  const trimmed = nextValue.trim();
  const hadContentHtml = Boolean(existing?.contentHtml?.trim());
  const looksLikeHtml = hasRichInlineFormatting(trimmed);

  if (hadContentHtml || looksLikeHtml) {
    const contentHtml = sanitizeInlineHtmlForParagraphPatch(trimmed);
    return {
      ...existing,
      contentHtml,
      text: inlineHtmlToPlainFallback(contentHtml),
      markdown: false,
    };
  }

  return {
    ...existing,
    text: trimmed,
    contentHtml: undefined,
    markdown: containsMergeTags(trimmed) ? false : existing?.markdown ?? false,
  };
}
