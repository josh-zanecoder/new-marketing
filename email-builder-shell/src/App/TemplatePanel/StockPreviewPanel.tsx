import React, { useMemo } from 'react';

import { Box } from '@mui/material';
import { Reader } from '@usewaypoint/email-builder';

import { useDocument, useSelectedScreenSize } from '../../documents/editor/EditorContext';
import {
  getPreviewEmailHtml,
  IMPORT_META_DOCUMENT_KEY,
  isImportedHtmlPreviewDocument,
  type TEmailBuilderDocument,
} from '../../utils/exportEmailHtml';
import { templatePanelMainBoxSx } from '../../utils/templatePanelMainBoxSx';

import ImportedHtmlPreviewFrame from './ImportedHtmlPreviewFrame';

/** EmailBuilder preview — full HTML/CSS/JS iframe for imports. */
export default function StockPreviewPanel() {
  const document = useDocument() as TEmailBuilderDocument;
  const selectedScreenSize = useSelectedScreenSize();
  const importedHtml = isImportedHtmlPreviewDocument(document);

  const previewHtml = useMemo(
    () => (importedHtml ? getPreviewEmailHtml(document) : ''),
    [document, importedHtml]
  );

  const readerDocument = useMemo(() => {
    const { [IMPORT_META_DOCUMENT_KEY]: _meta, ...blocks } = document;
    return blocks;
  }, [document]);

  if (importedHtml && previewHtml.trim()) {
    return <ImportedHtmlPreviewFrame html={previewHtml} title="Preview" />;
  }

  return (
    <Box sx={templatePanelMainBoxSx(selectedScreenSize)}>
      <Reader document={readerDocument} rootBlockId="root" />
    </Box>
  );
}
