import type { TEditorConfiguration } from '../documents/editor/core';

import {
  IMPORT_META_DOCUMENT_KEY,
  type ImportMetaDocumentEntry,
} from './exportEmailHtml';
import { extractBodyAttributes, extractHeadFragmentsFromHtml } from './extractHeadFragments';
import { extractBodyStyleTags, splitHtmlIntoSections } from './parseImportedHtmlSections';
import { htmlToEditableBlockDocument } from './htmlToEditableBlockDocument';
import { htmlGenericToBlockDocument } from './htmlGenericToBlockDocument';
import { extractBodyInnerHtmlPreserveMarkup } from '@shared/utils/extractBodyInnerHtml';
import { storeImportedFullDocumentHtml } from '@shared/utils/storeImportedFullDocument';

const MAX_HTML_BYTES = 2_000_000;

function createBlockId(): string {
  return `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function normalizeImportedEmailHtml(raw: string): string {
  const html = raw.trim();
  if (!html) {
    throw new Error('HTML is empty');
  }
  if (html.length > MAX_HTML_BYTES) {
    throw new Error('HTML is too large (max 2MB)');
  }
  return html;
}

/** Prefer body markup when a full HTML document is pasted or uploaded. */
export function extractImportableEmailHtml(raw: string): string {
  const normalized = normalizeImportedEmailHtml(raw);

  if (/<!doctype/i.test(normalized) || /<\s*html[\s>]/i.test(normalized)) {
    const bodyHtml = extractBodyInnerHtmlPreserveMarkup(normalized);
    if (bodyHtml) {
      return bodyHtml;
    }
  }

  return normalized;
}

/** Wrap body-only markup in a full HTML document for import storage and preview. */
function ensureFullImportDocument(raw: string): string {
  const normalized = normalizeImportedEmailHtml(raw);
  if (/<!doctype/i.test(normalized) || /<\s*html[\s>]/i.test(normalized)) {
    return normalized;
  }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body>${normalized}</body></html>`;
}

export type HtmlImportConversionMode = 'editable-blocks' | 'native-blocks' | 'passthrough';

export type HtmlImportResult = {
  document: TEditorConfiguration;
  htmlBlockId: string;
  mode: HtmlImportConversionMode;
  blockCount: number;
};

function buildPassthroughDocument(html: string): HtmlImportResult {
  const rawBody = extractImportableEmailHtml(html);
  const { body: bodyWithoutStyles, styleTags } = extractBodyStyleTags(rawBody);
  const headFragments = [...extractHeadFragmentsFromHtml(html), ...styleTags];
  const bodyAttributes = extractBodyAttributes(html);
  const sections = splitHtmlIntoSections(bodyWithoutStyles);

  const childrenIds: string[] = [];
  let firstHtmlBlockId = '';

  const document: TEditorConfiguration = {
    root: {
      type: 'EmailLayout',
      data: {
        backdropColor: '#F5F5F5',
        canvasColor: '#FFFFFF',
        textColor: '#262626',
        fontFamily: 'MODERN_SANS',
        childrenIds: [],
      },
    },
  };

  sections.forEach((sectionHtml) => {
    const htmlBlockId = createBlockId();
    if (!firstHtmlBlockId) firstHtmlBlockId = htmlBlockId;
    childrenIds.push(htmlBlockId);

    document[htmlBlockId] = {
      type: 'Html',
      data: {
        props: {
          contents: `<div data-eb-section-id="${htmlBlockId}">${sectionHtml}</div>`,
        },
        style: {
          fontSize: null,
          textAlign: null,
          padding: null,
        },
      },
    };
  });

  (document.root.data as { childrenIds: string[] }).childrenIds = childrenIds;

  const originalFullDocumentHtml = storeImportedFullDocumentHtml(html);

  (document as TEditorConfiguration & Record<string, ImportMetaDocumentEntry>)[IMPORT_META_DOCUMENT_KEY] = {
    type: 'ImportMeta',
    data: {
      mode: 'passthrough',
      passthrough: true,
      headFragments,
      bodyAttributes,
      originalFullDocumentHtml,
      fullDocumentHtml: originalFullDocumentHtml,
    },
  };

  return {
    document,
    htmlBlockId: firstHtmlBlockId,
    mode: 'passthrough',
    blockCount: childrenIds.length,
  };
}

function countNativeBlocks(document: TEditorConfiguration): number {
  const root = document.root;
  const childrenIds = (root.data as { childrenIds?: string[] | null })?.childrenIds ?? [];
  return childrenIds.filter((id) => {
    const type = (document[id] as { type?: string } | undefined)?.type;
    return type && type !== 'EmailLayout';
  }).length;
}

/**
 * Convert uploaded/pasted HTML into an EmailBuilder document.
 * Tries Beefree-style blocks first, then generic native blocks, then section passthrough.
 */
export function convertHtmlToEmailBuilderDocument(rawHtml: string): HtmlImportResult {
  const html = ensureFullImportDocument(rawHtml);
  const editable = htmlToEditableBlockDocument(html);
  if (editable) {
    return {
      document: editable.document,
      htmlBlockId: editable.htmlBlockId,
      mode: 'editable-blocks',
      blockCount: countNativeBlocks(editable.document),
    };
  }

  const generic = htmlGenericToBlockDocument(html);
  if (generic) {
    return {
      document: generic.document,
      htmlBlockId: generic.htmlBlockId,
      mode: 'native-blocks',
      blockCount: generic.blockCount,
    };
  }

  return buildPassthroughDocument(html);
}

/** @deprecated Use convertHtmlToEmailBuilderDocument for conversion metadata. */
export function htmlToEmailBuilderDocument(html: string): {
  document: TEditorConfiguration;
  htmlBlockId: string;
} {
  const result = convertHtmlToEmailBuilderDocument(html);
  return { document: result.document, htmlBlockId: result.htmlBlockId };
}

export function validateImportedEmailHtml(raw: string): { error: string | null; html: string | null } {
  try {
    return { error: null, html: extractImportableEmailHtml(raw) };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid HTML';
    return { error: message, html: null };
  }
}
