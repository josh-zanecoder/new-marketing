import { renderToStaticMarkup } from '@usewaypoint/email-builder';

import { replaceDocumentBodyInnerHtml } from '@shared/utils/storeImportedFullDocument';
import { mergeImportHeadAssets } from '@shared/utils/emailImportedAssets';

import type { TEditorBlock, TEditorConfiguration } from '../documents/editor/core';
import { withSyncedFullDocumentHtml } from './applyEditedEmailHtml';
import { mergeEditableBlocksIntoTemplate } from './htmlToEditableBlockDocument';

export const IMPORT_META_DOCUMENT_KEY = '__importMeta';

export type EditableBlockTarget = {
  markerId: string;
};

export type EditableBlockMapping = {
  blockId: string;
  kind: 'heading' | 'text' | 'image' | 'button' | 'divider' | 'spacer';
  targets: EditableBlockTarget[];
};

import type { ImportedBlockStyleOverride } from './importedBlockOverrides';

export type ImportMetaDocumentEntry = {
  type: 'ImportMeta';
  data: {
    mode?: 'passthrough' | 'editable-blocks' | 'native-blocks' | 'html-source';
    passthrough?: boolean;
    /** Canonical full HTML used for save/export (merged into original shell after edits). */
    fullDocumentHtml?: string;
    /** Verbatim HTML at import — used for browser-accurate preview. */
    originalFullDocumentHtml?: string;
    headFragments: string[];
    bodyAttributes?: string | null;
    templateBodyHtml?: string;
    blockMappings?: EditableBlockMapping[];
    blockStyleOverrides?: Record<string, ImportedBlockStyleOverride>;
    detectedFonts?: string[];
  };
};

export type TEmailBuilderDocument = TEditorConfiguration & {
  [IMPORT_META_DOCUMENT_KEY]?: ImportMetaDocumentEntry;
};

const DEFAULT_VIEWPORT =
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
const DEFAULT_CHARSET = '<meta charset="UTF-8">';

function wrapRenderedEmailBody(
  bodyMarkup: string,
  meta: ImportMetaDocumentEntry['data']
): string {
  const headFragments = meta.headFragments ?? [];
  const bodyAttributes = meta.bodyAttributes?.trim();

  const hasViewport = headFragments.some((tag) => /name=["']viewport["']/i.test(tag));
  const hasCharset = headFragments.some((tag) => /<meta\b[^>]*charset/i.test(tag));

  const headParts = [
    ...(hasCharset ? [] : [DEFAULT_CHARSET]),
    ...(hasViewport ? [] : [DEFAULT_VIEWPORT]),
    ...headFragments,
  ];

  const bodyOpen = bodyAttributes ? `<body ${bodyAttributes}>` : '<body>';
  return `<!DOCTYPE html><html lang="en"><head>${headParts.join('')}</head>${bodyOpen}${bodyMarkup}</body></html>`;
}

export function readImportMeta(document: TEmailBuilderDocument): ImportMetaDocumentEntry['data'] | null {
  return document[IMPORT_META_DOCUMENT_KEY]?.data ?? null;
}

export function isHtmlSourceDocument(document: Record<string, unknown>): boolean {
  const meta = readImportMeta(document as TEmailBuilderDocument);
  return meta?.mode === 'html-source' && !!meta.fullDocumentHtml?.trim();
}

export function isImportedPassthroughDocument(document: Record<string, unknown>): boolean {
  const meta = readImportMeta(document as TEmailBuilderDocument);
  if (meta?.mode === 'html-source' || meta?.mode === 'editable-blocks') return false;
  if (meta?.mode === 'passthrough' || meta?.passthrough) {
    const root = document.root as TEditorBlock | undefined;
    if (!root || root.type !== 'EmailLayout') return false;
    const childrenIds = (root.data as { childrenIds?: string[] | null })?.childrenIds ?? [];
    if (childrenIds.length === 0) return false;
    return childrenIds.every((id) => (document[id] as TEditorBlock | undefined)?.type === 'Html');
  }
  return false;
}

export function isEditableBlocksImport(document: Record<string, unknown>): boolean {
  const meta = readImportMeta(document as TEmailBuilderDocument);
  if (meta?.mode === 'html-source' || meta?.mode === 'native-blocks') return false;
  return meta?.mode === 'editable-blocks' && !!meta.templateBodyHtml;
}

export function isNativeBlocksImport(document: Record<string, unknown>): boolean {
  const meta = readImportMeta(document as TEmailBuilderDocument);
  return meta?.mode === 'native-blocks';
}

export function isImportedHtmlPreviewDocument(document: Record<string, unknown>): boolean {
  if (isNativeBlocksImport(document)) return false;
  return (
    isHtmlSourceDocument(document) ||
    isImportedPassthroughDocument(document) ||
    isEditableBlocksImport(document)
  );
}

/** @deprecated Use isImportedPassthroughDocument */
export function isImportedHtmlOnlyDocument(document: Record<string, unknown>): boolean {
  return isImportedPassthroughDocument(document);
}

function readHtmlBlockContents(document: TEmailBuilderDocument, blockId: string): string {
  const block = document[blockId] as TEditorBlock | undefined;
  if (block?.type !== 'Html') return '';
  return (block.data as { props?: { contents?: string | null } })?.props?.contents?.trim() ?? '';
}

export function buildPassthroughExportHtml(document: TEmailBuilderDocument): string {
  const root = document.root;
  const childrenIds = (root.data as { childrenIds?: string[] | null })?.childrenIds ?? [];

  const contents = childrenIds.map((id) => readHtmlBlockContents(document, id)).join('');

  const importMeta = readImportMeta(document);
  const headFragments = mergeImportHeadAssets(
    importMeta?.originalFullDocumentHtml ?? '',
    importMeta?.headFragments ?? []
  );
  const bodyAttributes = importMeta?.bodyAttributes?.trim();

  const hasViewport = headFragments.some((tag) => /name=["']viewport["']/i.test(tag));
  const hasCharset = headFragments.some((tag) => /<meta\b[^>]*charset/i.test(tag));

  const headParts = [
    ...(hasCharset ? [] : [DEFAULT_CHARSET]),
    ...(hasViewport ? [] : [DEFAULT_VIEWPORT]),
    ...headFragments,
  ];

  const bodyOpen = bodyAttributes ? `<body ${bodyAttributes}>` : '<body>';
  const rebuilt = `<!DOCTYPE html><html lang="en"><head>${headParts.join('')}</head>${bodyOpen}${contents}</body></html>`;

  if (importMeta?.originalFullDocumentHtml?.trim()) {
    return replaceDocumentBodyInnerHtml(importMeta.originalFullDocumentHtml, contents);
  }

  return rebuilt;
}

/** HTML for preview iframe — responsive Beefree/Stripo shell with synced block edits when present. */
export function getPreviewEmailHtml(document: TEditorConfiguration): string {
  return resolveIframePreviewHtml(document, 'preview');
}

/** HTML for editor canvas with click-target markers (editable imports). */
export function getEditorCanvasHtml(document: TEditorConfiguration): string {
  return resolveIframePreviewHtml(document, 'editor-canvas');
}

/**
 * Full HTML document for browser-accurate iframe preview (Edit + Preview tabs).
 * Keeps `<head>` styles from imports like Beefree Untitled.html (@media 780px).
 */
export function resolveIframePreviewHtml(
  document: TEditorConfiguration,
  source: 'preview' | 'editor-canvas' = 'preview'
): string {
  const doc = document as TEmailBuilderDocument;

  if (source === 'editor-canvas' && isImportedPassthroughDocument(doc)) {
    return buildPassthroughExportHtml(doc);
  }

  if (source === 'editor-canvas' && isEditableBlocksImport(doc)) {
    try {
      return mergeEditableBlocksIntoTemplate(doc);
    } catch {
      const meta = readImportMeta(doc);
      if (meta?.fullDocumentHtml?.trim()) return meta.fullDocumentHtml.trim();
      if (meta?.originalFullDocumentHtml?.trim()) return meta.originalFullDocumentHtml.trim();
    }
  }

  if (
    source === 'preview' &&
    (isEditableBlocksImport(doc) ||
      isImportedPassthroughDocument(doc) ||
      isHtmlSourceDocument(doc))
  ) {
    return exportEmailBuilderDocumentHtml(doc);
  }

  const meta = readImportMeta(doc);
  if (source === 'preview') {
    if (meta?.fullDocumentHtml?.trim()) {
      return meta.fullDocumentHtml.trim();
    }
    if (meta?.originalFullDocumentHtml?.trim()) {
      return meta.originalFullDocumentHtml.trim();
    }
  }

  if (meta?.originalFullDocumentHtml?.trim() && (meta.mode === 'passthrough' || meta.mode === 'html-source')) {
    return meta.originalFullDocumentHtml.trim();
  }

  return exportEmailBuilderDocumentHtml(document);
}

/** Canonical HTML shown in the HTML tab and save/export. */
export function getCanonicalEmailHtml(document: TEditorConfiguration): string {
  return exportEmailBuilderDocumentHtml(document);
}

/** Export HTML for preview, save, and send — always reflects current block edits. */
export function exportEmailBuilderDocumentHtml(document: TEditorConfiguration): string {
  const doc = withSyncedFullDocumentHtml(document) as TEmailBuilderDocument;
  const meta = readImportMeta(doc);

  if (isEditableBlocksImport(doc)) {
    return mergeEditableBlocksIntoTemplate(doc);
  }

  if (isImportedPassthroughDocument(doc) || isHtmlSourceDocument(doc)) {
    return buildPassthroughExportHtml(doc);
  }

  if (isNativeBlocksImport(doc)) {
    const body = renderToStaticMarkup(doc, { rootBlockId: 'root' });
    return wrapRenderedEmailBody(body, meta ?? { headFragments: [] });
  }

  if (meta?.fullDocumentHtml?.trim()) {
    return meta.fullDocumentHtml.trim();
  }

  return renderToStaticMarkup(doc, { rootBlockId: 'root' });
}
