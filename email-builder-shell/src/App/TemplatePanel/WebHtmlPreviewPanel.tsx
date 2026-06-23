import React, { useCallback, useEffect, useRef } from 'react';

import { Box } from '@mui/material';

import {
  setInspectorDrawerOpen,
  setSelectedBlockId,
  setSidebarTab,
  useDocument,
  useSelectedBlockId,
} from '../../documents/editor/EditorContext';
import {
  isEditableBlocksImport,
  isHtmlSourceDocument,
  isImportedPassthroughDocument,
  type TEmailBuilderDocument,
} from '../../utils/exportEmailHtml';
import { EDITABLE_BLOCKS_EDITOR_BRIDGE, findBlockIdForMarker, primaryMarkerForBlock } from '../../utils/editableBlocksEditorBridge';

import WebHtmlPreview from './WebHtmlPreview';
import { PASSTHROUGH_HTML_EDITOR_BRIDGE } from './PassthroughHtmlEditorCanvas';

type WebHtmlPreviewPanelProps = {
  mode: 'editor' | 'preview';
};

function editorBridgeForDocument(document: Record<string, unknown>): string | undefined {
  if (isHtmlSourceDocument(document) || isImportedPassthroughDocument(document)) {
    return PASSTHROUGH_HTML_EDITOR_BRIDGE;
  }
  if (isEditableBlocksImport(document)) {
    return EDITABLE_BLOCKS_EDITOR_BRIDGE;
  }
  return undefined;
}

function isImportedHtmlDocument(document: Record<string, unknown>): boolean {
  return (
    isHtmlSourceDocument(document) ||
    isEditableBlocksImport(document) ||
    isImportedPassthroughDocument(document)
  );
}

export default function WebHtmlPreviewPanel({ mode }: WebHtmlPreviewPanelProps) {
  const document = useDocument() as TEmailBuilderDocument;
  const selectedBlockId = useSelectedBlockId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isEditor = mode === 'editor';
  const editorBridge = isEditor ? editorBridgeForDocument(document) : undefined;
  const importedHtml = isImportedHtmlDocument(document);
  const editableBlocks = isEditableBlocksImport(document);
  const passthroughHtml = isHtmlSourceDocument(document) || isImportedPassthroughDocument(document);

  const highlightMarker = useCallback((markerId: string | null) => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage({ type: 'email-builder:highlight-marker', markerId }, '*');
  }, []);

  const highlightSection = useCallback((sectionId: string | null) => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage({ type: 'email-builder:highlight-section', sectionId: sectionId ?? '' }, '*');
  }, []);

  useEffect(() => {
    if (!isEditor) return;
    if (editableBlocks) {
      highlightMarker(primaryMarkerForBlock(document, selectedBlockId));
    } else if (passthroughHtml) {
      highlightSection(selectedBlockId);
    }
  }, [document, selectedBlockId, isEditor, editableBlocks, passthroughHtml, highlightMarker, highlightSection]);

  useEffect(() => {
    if (!isEditor || !importedHtml) return;

    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'email-builder:select-marker' && editableBlocks) {
        const markerId = typeof data.markerId === 'string' ? data.markerId : '';
        if (!markerId) return;
        const blockId = findBlockIdForMarker(document, markerId);
        if (!blockId) return;
        setSelectedBlockId(blockId);
        setSidebarTab('block-configuration');
        setInspectorDrawerOpen(true);
        highlightMarker(markerId);
        return;
      }

      if (data.type === 'email-builder:select-section' && passthroughHtml) {
        const sectionId = typeof data.sectionId === 'string' ? data.sectionId : '';
        if (!sectionId) return;
        setSelectedBlockId(sectionId);
        setSidebarTab('block-configuration');
        setInspectorDrawerOpen(true);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [document, isEditor, importedHtml, editableBlocks, passthroughHtml, highlightMarker]);

  const handlePreviewLoad = useCallback(() => {
    if (!isEditor) return;
    if (editableBlocks) {
      highlightMarker(primaryMarkerForBlock(document, selectedBlockId));
    } else if (passthroughHtml) {
      highlightSection(selectedBlockId);
    }
  }, [document, selectedBlockId, isEditor, editableBlocks, passthroughHtml, highlightMarker, highlightSection]);

  return (
    <Box sx={{ width: '100%' }}>
      <WebHtmlPreview
        title={isEditor ? 'Email preview' : 'Preview'}
        iframeRef={isEditor && importedHtml ? iframeRef : undefined}
        onLoad={isEditor && importedHtml ? handlePreviewLoad : undefined}
        editorHeadInjection={editorBridge}
        htmlSource={isEditor && importedHtml ? 'editor-canvas' : 'preview'}
      />
    </Box>
  );
}
