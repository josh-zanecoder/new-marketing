import type { TEditorConfiguration } from '../documents/editor/core';

import { extractBodyAttributes, extractHeadFragmentsFromHtml } from './extractHeadFragments';
import {
  IMPORT_META_DOCUMENT_KEY,
  type ImportMetaDocumentEntry,
  buildPassthroughExportHtml,
  readImportMeta,
} from './exportEmailHtml';
import { extractImportableEmailHtml, normalizeImportedEmailHtml } from './importEmailHtml';
import { mergeEditableBlocksIntoTemplate, mergeEditableBlocksResult } from './htmlToEditableBlockDocument';

function createBlockId(): string {
  return `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

/** Wrap body-only markup in a full HTML document. */
export function ensureFullDocumentHtml(raw: string): string {
  const normalized = normalizeImportedEmailHtml(raw);
  if (/<!doctype/i.test(normalized) || /<\s*html[\s>]/i.test(normalized)) {
    return normalized;
  }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${normalized}</body></html>`;
}

/** Store exact HTML as the canonical design/export source (html-source mode). */
export function buildHtmlSourceDocument(rawHtml: string): TEditorConfiguration {
  const fullDocumentHtml = ensureFullDocumentHtml(rawHtml);
  const headFragments = extractHeadFragmentsFromHtml(fullDocumentHtml);
  const bodyAttributes = extractBodyAttributes(fullDocumentHtml);
  const bodyHtml = extractImportableEmailHtml(fullDocumentHtml);
  const htmlBlockId = createBlockId();

  const document: TEditorConfiguration = {
    root: {
      type: 'EmailLayout',
      data: {
        backdropColor: '#F5F5F5',
        canvasColor: '#FFFFFF',
        textColor: '#262626',
        fontFamily: 'MODERN_SANS',
        childrenIds: [htmlBlockId],
      },
    },
    [htmlBlockId]: {
      type: 'Html',
      data: {
        props: {
          contents: `<div data-eb-section-id="${htmlBlockId}">${bodyHtml}</div>`,
        },
        style: {
          fontSize: null,
          textAlign: null,
          padding: null,
        },
      },
    },
  };

  (document as TEditorConfiguration & Record<string, ImportMetaDocumentEntry>)[IMPORT_META_DOCUMENT_KEY] = {
    type: 'ImportMeta',
    data: {
      mode: 'html-source',
      passthrough: false,
      fullDocumentHtml,
      originalFullDocumentHtml: fullDocumentHtml,
      headFragments,
      bodyAttributes,
    },
  };

  return document;
}

export function applyEditedEmailHtmlToDocument(rawHtml: string): TEditorConfiguration {
  return buildHtmlSourceDocument(rawHtml);
}

export function validateEditedEmailHtml(rawHtml: string): { error: string | null } {
  try {
    normalizeImportedEmailHtml(rawHtml);
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid HTML' };
  }
}

export function extractMergeTagsFromHtml(html: string): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    found.add(match[1].trim());
  }
  return Array.from(found).sort();
}

/** Keep stored full-document HTML aligned with block edits for imported designs. */
export function syncFullDocumentHtml(document: TEditorConfiguration): TEditorConfiguration {
  const doc = document as TEditorConfiguration & Record<string, ImportMetaDocumentEntry>;
  const meta = readImportMeta(doc);
  if (!meta) return document;

  let html = '';
  let patchedTemplateBodyHtml: string | undefined;
  if (meta.mode === 'editable-blocks' && meta.templateBodyHtml) {
    const merged = mergeEditableBlocksResult(doc);
    html = merged.fullHtml;
    patchedTemplateBodyHtml = merged.patchedTemplateBodyHtml;
  } else if (meta.mode === 'passthrough' || meta.passthrough || meta.mode === 'html-source') {
    html = buildPassthroughExportHtml(doc);
  } else {
    return document;
  }

  return {
    ...doc,
    [IMPORT_META_DOCUMENT_KEY]: {
      type: 'ImportMeta',
      data: {
        ...meta,
        fullDocumentHtml: html,
        ...(patchedTemplateBodyHtml ? { templateBodyHtml: patchedTemplateBodyHtml } : {}),
      },
    },
  };
}

export function withSyncedFullDocumentHtml(document: TEditorConfiguration): TEditorConfiguration {
  return syncFullDocumentHtml(document);
}
