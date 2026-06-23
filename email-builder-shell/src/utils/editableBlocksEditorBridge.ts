import type { TEmailBuilderDocument } from './exportEmailHtml';
import { getCanonicalEmailHtml, readImportMeta } from './exportEmailHtml';

export const EDITABLE_BLOCKS_EDITOR_BRIDGE = `
<style id="eb-editor-bridge">
  [data-eb-id] { cursor: pointer; }
  [data-eb-id]:hover { outline: 2px solid rgba(0,121,204,0.35); outline-offset: -2px; }
  [data-eb-id].eb-selected { outline: 2px solid rgba(0,121,204,1); outline-offset: -2px; }
</style>
<script id="eb-editor-bridge">
(function () {
  function clearSelected() {
    document.querySelectorAll('[data-eb-id].eb-selected').forEach(function (node) {
      node.classList.remove('eb-selected');
    });
  }
  document.addEventListener('click', function (ev) {
    var target = ev.target;
    if (!target || !target.closest) return;
    var el = target.closest('[data-eb-id]');
    if (!el) return;
    ev.preventDefault();
    ev.stopPropagation();
    clearSelected();
    el.classList.add('eb-selected');
    parent.postMessage(
      { type: 'email-builder:select-marker', markerId: el.getAttribute('data-eb-id') },
      '*'
    );
  }, true);
  window.addEventListener('message', function (ev) {
    var data = ev.data;
    if (!data || data.type !== 'email-builder:highlight-marker') return;
    clearSelected();
    if (!data.markerId) return;
    document.querySelectorAll('[data-eb-id="' + data.markerId + '"]').forEach(function (node) {
      node.classList.add('eb-selected');
    });
  });
})();
</script>`;

export function findBlockIdForMarker(
  document: TEmailBuilderDocument,
  markerId: string
): string | null {
  const mappings = readImportMeta(document)?.blockMappings ?? [];
  for (const mapping of mappings) {
    if (mapping.targets.some((target) => target.markerId === markerId)) {
      return mapping.blockId;
    }
  }
  return null;
}

export function primaryMarkerForBlock(
  document: TEmailBuilderDocument,
  blockId: string | null
): string | null {
  if (!blockId) return null;
  const mapping = readImportMeta(document)?.blockMappings?.find((m) => m.blockId === blockId);
  return mapping?.targets[0]?.markerId ?? null;
}

/** @deprecated Use buildHtmlCodePreviewDocument with EDITABLE_BLOCKS_EDITOR_BRIDGE */
export function buildEditableBlocksEditorSrcDoc(document: TEmailBuilderDocument): string {
  const html = getCanonicalEmailHtml(document);
  if (html.includes('</head>')) {
    return html.replace('</head>', `${EDITABLE_BLOCKS_EDITOR_BRIDGE}</head>`);
  }
  return `${EDITABLE_BLOCKS_EDITOR_BRIDGE}${html}`;
}
