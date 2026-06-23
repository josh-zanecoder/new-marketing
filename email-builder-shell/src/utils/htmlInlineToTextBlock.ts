import {
  containsMergeTags,
  normalizeMergeTagAttributeHtml,
} from './mergeTagText';

/** Convert inline HTML to EmailBuilder Text block props (preserves merge tags). */
export function htmlInlineToTextBlockProps(source: string): { text: string; markdown: boolean } | null {
  const trimmed = normalizeMergeTagAttributeHtml(source).trim();
  if (!trimmed) return null;

  if (containsMergeTags(trimmed) && /<a\b/i.test(trimmed)) {
    return null;
  }

  if (containsMergeTags(trimmed)) {
    const text = trimmed
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?p[^>]*>/gi, '\n')
      .replace(/<\/?div[^>]*>/gi, '\n')
      .replace(/<\/?span[^>]*>/gi, '')
      .replace(/<\/?strong>/gi, '**')
      .replace(/<\/?em>/gi, '*')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text ? { text, markdown: false } : null;
  }

  if (/<a\b/i.test(trimmed)) {
    const markdown = trimmed
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?p[^>]*>/gi, '\n')
      .replace(/<\/?div[^>]*>/gi, '\n')
      .replace(/<\/?span[^>]*>/gi, '')
      .replace(
        /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_, href, label) => {
          const linkText = label.replace(/<[^>]+>/g, '').trim() || href;
          return `[${linkText}](${href})`;
        }
      )
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return markdown ? { text: markdown, markdown: true } : null;
  }

  const text = trimmed
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p[^>]*>/gi, '\n')
    .replace(/<\/?div[^>]*>/gi, '\n')
    .replace(/<\/?span[^>]*>/gi, '')
    .replace(/<\/?strong>/gi, '**')
    .replace(/<\/?em>/gi, '*')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text ? { text, markdown: false } : null;
}
