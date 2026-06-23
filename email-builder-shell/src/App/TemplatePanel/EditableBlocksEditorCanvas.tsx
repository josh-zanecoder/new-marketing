import React, { useCallback, useEffect, useRef } from 'react';

import { Box } from '@mui/material';

import {
  setInspectorDrawerOpen,
  setSelectedBlockId,
  setSidebarTab,
  useDocument,
  useSelectedBlockId,
} from '../../documents/editor/EditorContext';
import type { TEmailBuilderDocument } from '../../utils/exportEmailHtml';
import {
  EDITABLE_BLOCKS_EDITOR_BRIDGE,
  findBlockIdForMarker,
  primaryMarkerForBlock,
} from '../../utils/editableBlocksEditorBridge';

import CompiledEmailPreview from './CompiledEmailPreview';

export default function EditableBlocksEditorCanvas() {
  const document = useDocument() as TEmailBuilderDocument;
  const selectedBlockId = useSelectedBlockId();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const highlightMarker = useCallback((markerId: string | null) => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage({ type: 'email-builder:highlight-marker', markerId }, '*');
  }, []);

  useEffect(() => {
    highlightMarker(primaryMarkerForBlock(document, selectedBlockId));
  }, [document, selectedBlockId, highlightMarker]);

  const handlePreviewLoad = useCallback(() => {
    highlightMarker(primaryMarkerForBlock(document, selectedBlockId));
  }, [document, selectedBlockId, highlightMarker]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || typeof data !== 'object' || data.type !== 'email-builder:select-marker') return;
      const markerId = typeof data.markerId === 'string' ? data.markerId : '';
      if (!markerId) return;

      const blockId = findBlockIdForMarker(document, markerId);
      if (!blockId) return;

      setSelectedBlockId(blockId);
      setSidebarTab('block-configuration');
      setInspectorDrawerOpen(true);
      highlightMarker(markerId);
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [document, highlightMarker]);

  return (
    <Box sx={{ width: '100%' }}>
      <CompiledEmailPreview
        title="Email preview"
        iframeRef={iframeRef}
        editorHeadInjection={EDITABLE_BLOCKS_EDITOR_BRIDGE}
        onLoad={handlePreviewLoad}
        htmlSource="editor-canvas"
      />
    </Box>
  );
}
