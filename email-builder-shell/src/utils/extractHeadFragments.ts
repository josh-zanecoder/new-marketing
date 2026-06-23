import {
  extractStyleTagsFromHtml,
  mergeImportHeadAssets,
} from '@shared/utils/emailImportedAssets';

/** Collect `<head>` tags that affect layout (styles, scripts, viewport, fonts) for email HTML export. */
export function extractHeadFragmentsFromHtml(raw: string): string[] {
  const normalized = raw.trim();
  if (!normalized) return [];

  if (!/<!doctype/i.test(normalized) && !/<\s*html[\s>]/i.test(normalized)) {
    return extractStyleTagsFromHtml(normalized);
  }

  const doc = new DOMParser().parseFromString(normalized, 'text/html');
  const fragments: string[] = [];

  doc.head.querySelectorAll('style').forEach((el) => {
    fragments.push(el.outerHTML);
  });
  doc.head.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
    fragments.push(el.outerHTML);
  });
  doc.head.querySelectorAll('script').forEach((el) => {
    fragments.push(el.outerHTML);
  });
  doc.head.querySelectorAll('meta').forEach((el) => {
    fragments.push(el.outerHTML);
  });
  doc.head.querySelectorAll('title').forEach((el) => {
    fragments.push(el.outerHTML);
  });
  doc.head.querySelectorAll('base').forEach((el) => {
    fragments.push(el.outerHTML);
  });

  return mergeImportHeadAssets(normalized, fragments);
}

export function extractBodyAttributes(raw: string): string | null {
  const normalized = raw.trim();
  if (!/<!doctype/i.test(normalized) && !/<\s*html[\s>]/i.test(normalized)) return null;

  const match = normalized.match(/<body\b([^>]*)>/i);
  if (!match?.[1]?.trim()) return null;
  return match[1].trim();
}
