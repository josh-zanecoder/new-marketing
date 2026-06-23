/** Fix anchors broken by legacy import (`<a {{unsubscribe}}>` → proper href). */
export function restoreBrokenMergeTagAnchors(html: string): string {
  return html.replace(/<a\b([^>]*?)\s+\{\{\s*([^}]+?)\s*\}\}/gi, (_match, attrs, key) => {
    const cleanAttrs = String(attrs ?? '').trim();
    return cleanAttrs ? `<a ${cleanAttrs} href="{{${key}}}">` : `<a href="{{${key}}}">`;
  });
}

/** Normalize inline HTML for import/edit — keep merge tokens in href/src intact. */
export function normalizeMergeTagAttributeHtml(html: string): string {
  return restoreBrokenMergeTagAnchors(html);
}

/**
 * Send-ready HTML: URL merge tags (e.g. unsubscribe) must be in href, not visible text.
 * Run before per-recipient merge so {{unsubscribe}} becomes the link target.
 */
export function repairMergeTagAnchorsForSend(html: string): string {
  let out = restoreBrokenMergeTagAnchors(html);

  out = out.replace(
    /(<a\b[^>]*href=["']\{\{\s*unsubscribe\s*\}\}["'][^>]*>[\s\S]*?<\/a>)\s*\{\{\s*unsubscribe\s*\}\}/gi,
    '$1'
  );

  out = out.replace(
    /(Click here)\.?\s*\{\{\s*unsubscribe\s*\}\}/gi,
    '<a href="{{unsubscribe}}">$1</a>'
  );

  out = out.replace(
    /(unsubscribe from this list\.\s*)(\{\{\s*unsubscribe\s*\}\})/gi,
    '$1<a href="{{unsubscribe}}">Click here</a>'
  );

  return out;
}
