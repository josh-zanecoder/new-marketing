import type { TEditorBlock, TEditorConfiguration } from '../documents/editor/core';

import {
  IMPORT_META_DOCUMENT_KEY,
  type ImportMetaDocumentEntry,
  type TEmailBuilderDocument,
  readImportMeta,
} from './exportEmailHtml';
import type { ImportedBlockStyle } from './importedBlockStyleSync';

export type ImportedBlockPadding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type ImportedBlockStyleOverride = ImportedBlockStyle & {
  fontFamilyCss?: string | null;
  padding?: ImportedBlockPadding | null;
};

export function readBlockStyleOverride(
  document: TEmailBuilderDocument,
  blockId: string
): ImportedBlockStyleOverride {
  return readImportMeta(document)?.blockStyleOverrides?.[blockId] ?? {};
}

export function setBlockStyleOverride(
  document: TEditorConfiguration,
  blockId: string,
  patch: Partial<ImportedBlockStyleOverride>
): TEditorConfiguration {
  const doc = document as TEmailBuilderDocument & Record<string, ImportMetaDocumentEntry>;
  const meta = doc[IMPORT_META_DOCUMENT_KEY];
  if (!meta) return document;

  const current = meta.data.blockStyleOverrides?.[blockId] ?? {};
  const nextOverride = { ...current, ...patch };

  return {
    ...document,
    [IMPORT_META_DOCUMENT_KEY]: {
      ...meta,
      data: {
        ...meta.data,
        blockStyleOverrides: {
          ...(meta.data.blockStyleOverrides ?? {}),
          [blockId]: nextOverride,
        },
      },
    },
  };
}

export function mergeImportedBlockStyle(
  document: TEmailBuilderDocument,
  blockId: string,
  block: TEditorBlock
): ImportedBlockStyleOverride {
  const blockStyle = ((block.data as { style?: ImportedBlockStyleOverride })?.style ?? {}) as ImportedBlockStyleOverride;
  const overrides = readBlockStyleOverride(document, blockId);
  return {
    ...blockStyle,
    ...overrides,
    padding: overrides.padding ?? blockStyle.padding ?? null,
    fontSize: overrides.fontSize ?? blockStyle.fontSize ?? null,
    fontFamilyCss: overrides.fontFamilyCss ?? blockStyle.fontFamilyCss ?? null,
  };
}
