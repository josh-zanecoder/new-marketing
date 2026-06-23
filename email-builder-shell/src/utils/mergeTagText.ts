import {
  normalizeMergeTagAttributeHtml,
  repairMergeTagAnchorsForSend,
  restoreBrokenMergeTagAnchors,
} from '@shared/utils/mergeTagHtmlRepair';

/** Detect Mustache-style merge tags in plain text or HTML. */
export function containsMergeTags(value: string): boolean {
  return /\{\{[\s\S]*?\}\}/.test(value);
}

/** Escape plain text (with merge tags) for safe HTML paragraph/heading content. */
export function plainTextToInlineHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export {
  normalizeMergeTagAttributeHtml,
  restoreBrokenMergeTagAnchors,
  repairMergeTagAnchorsForSend,
};

/** @deprecated Use normalizeMergeTagAttributeHtml — old helper stripped href and broke sent emails. */
export function surfaceMergeTagsFromAttributes(html: string): string {
  return normalizeMergeTagAttributeHtml(html);
}

/** Merge tags must stay literal — never run through markdown link conversion. */
export function mergeTagSafeMarkdownFlag(text: string, markdown?: boolean): boolean {
  if (containsMergeTags(text)) return false;
  return markdown ?? false;
}
