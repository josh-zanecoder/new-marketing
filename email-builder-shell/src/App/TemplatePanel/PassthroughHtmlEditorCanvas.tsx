import React, { useEffect, useRef } from 'react';

import {
  setInspectorDrawerOpen,
  setSelectedBlockId,
  setSidebarTab,
  useDocument,
  useSelectedBlockId,
} from '../../documents/editor/EditorContext';
import type { TEmailBuilderDocument } from '../../utils/exportEmailHtml';

import CompiledEmailPreview from './CompiledEmailPreview';

type PassthroughHtmlEditorCanvasProps = {
  mobile: boolean;
};

export const PASSTHROUGH_HTML_EDITOR_BRIDGE = `
<style id="eb-section-bridge">
  [data-eb-section-id] { cursor: pointer; }
  [data-eb-section-id]:hover { outline: 2px solid rgba(0,121,204,0.35); outline-offset: -2px; }
  [data-eb-section-id].eb-selected { outline: 2px solid rgba(0,121,204,1); outline-offset: -2px; }
</style>
<script id="eb-section-bridge">
(function () {
  function clearSelected() {
    document.querySelectorAll('[data-eb-section-id].eb-selected').forEach(function (node) {
      node.classList.remove('eb-selected');
    });
  }
  document.addEventListener('click', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-eb-section-id]') : null;
    if (!el) return;
    ev.preventDefault();
    ev.stopPropagation();
    clearSelected();
    el.classList.add('eb-selected');
    parent.postMessage(
      { type: 'email-builder:select-section', sectionId: el.getAttribute('data-eb-section-id') },
      '*'
    );
  }, true);
  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.type !== 'email-builder:highlight-section') return;
    clearSelected();
    if (!ev.data.sectionId) return;
    document.querySelectorAll('[data-eb-section-id="' + ev.data.sectionId + '"]').forEach(function (node) {
      node.classList.add('eb-selected');
    });
  });
})();
</script>`;

export default function PassthroughHtmlEditorCanvas(_props: PassthroughHtmlEditorCanvasProps) {
  const document = useDocument() as TEmailBuilderDocument;
  const selectedBlockId = useSelectedBlockId();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(
      { type: 'email-builder:highlight-section', sectionId: selectedBlockId },
      '*'
    );
  }, [selectedBlockId, document]);

  const handlePreviewLoad = () => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(
      { type: 'email-builder:highlight-section', sectionId: selectedBlockId },
      '*'
    );
  };

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data;
      if (!data || data.type !== 'email-builder:select-section') return;
      const sectionId = typeof data.sectionId === 'string' ? data.sectionId : '';
      if (!sectionId) return;
      setSelectedBlockId(sectionId);
      setSidebarTab('block-configuration');
      setInspectorDrawerOpen(true);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <CompiledEmailPreview
      title="Imported HTML section editor"
      iframeRef={iframeRef}
      editorHeadInjection={PASSTHROUGH_HTML_EDITOR_BRIDGE}
      onLoad={handlePreviewLoad}
    />
  );
}
