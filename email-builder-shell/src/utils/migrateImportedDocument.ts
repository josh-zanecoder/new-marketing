import type { TEditorConfiguration } from '../documents/editor/core';

import { IMPORT_META_DOCUMENT_KEY, readImportMeta } from './exportEmailHtml';
import { convertHtmlToEmailBuilderDocument } from './importEmailHtml';
import { htmlToEditableBlockDocument, enrichImportedBlockContentFromTemplate } from './htmlToEditableBlockDocument';

function hasLegacyGroupedBlockMappings(document: TEditorConfiguration): boolean {
  const meta = readImportMeta(document as TEditorConfiguration & Record<string, unknown>);
  if (meta?.mode !== 'editable-blocks') return false;
  return (meta.blockMappings ?? []).some((mapping) => mapping.targets.length > 1);
}

/** Upgrade legacy passthrough imports to native editable blocks when possible. */
export function migrateImportedDocument(document: TEditorConfiguration): TEditorConfiguration {
  const existingMeta = readImportMeta(document as TEditorConfiguration & Record<string, unknown>);
  if (existingMeta?.mode === 'html-source') return document;

  if (existingMeta?.mode === 'editable-blocks' && hasLegacyGroupedBlockMappings(document)) {
    const sourceHtml =
      existingMeta.fullDocumentHtml?.trim() || existingMeta.originalFullDocumentHtml?.trim() || '';
    if (sourceHtml) {
      const rebuilt = htmlToEditableBlockDocument(sourceHtml);
      if (rebuilt?.document) return rebuilt.document;
    }
  }

  if (existingMeta?.mode === 'editable-blocks') {
    return enrichImportedBlockContentFromTemplate(document);
  }
  if (existingMeta?.mode === 'native-blocks') return document;

  const root = document.root;
  if (!root || root.type !== 'EmailLayout') return document;

  const childrenIds = (root.data as { childrenIds?: string[] | null })?.childrenIds ?? [];
  const allHtml = childrenIds.every(
    (id) => (document[id] as { type?: string } | undefined)?.type === 'Html'
  );
  if (!allHtml || childrenIds.length === 0) return document;

  const combinedBody = childrenIds
    .map((id) => {
      const block = document[id] as { data?: { props?: { contents?: string } } };
      return block?.data?.props?.contents ?? '';
    })
    .join('');

  const wrappedHtml = `<!DOCTYPE html><html><body>${combinedBody}</body></html>`;
  const converted = convertHtmlToEmailBuilderDocument(wrappedHtml);
  if (converted.mode !== 'passthrough') {
    const next = converted.document as TEditorConfiguration & Record<string, unknown>;
    const meta = next[IMPORT_META_DOCUMENT_KEY];
    if (meta && existingMeta?.headFragments?.length) {
      meta.data.headFragments = [
        ...existingMeta.headFragments,
        ...meta.data.headFragments,
      ];
      if (existingMeta.bodyAttributes) {
        meta.data.bodyAttributes = existingMeta.bodyAttributes;
      }
    }
    return next;
  }

  return converted.document;
}
