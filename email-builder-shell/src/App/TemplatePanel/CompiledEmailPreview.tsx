import React, { useMemo } from 'react';

import { useDocument } from '../../documents/editor/EditorContext';
import {
  getEditorCanvasHtml,
  getPreviewEmailHtml,
  type TEmailBuilderDocument,
} from '../../utils/exportEmailHtml';

import ImportedHtmlPreviewFrame from './ImportedHtmlPreviewFrame';

type CompiledEmailPreviewProps = {
  title?: string;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  onLoad?: () => void;
  editorHeadInjection?: string;
  htmlSource?: 'preview' | 'editor-canvas';
};

export function buildHtmlCodePreviewDocument(
  document: TEmailBuilderDocument,
  options?: {
    editorHeadInjection?: string;
    htmlSource?: 'preview' | 'editor-canvas';
  }
): string {
  const htmlSource = options?.htmlSource ?? 'editor-canvas';
  return htmlSource === 'preview'
    ? getPreviewEmailHtml(document)
    : getEditorCanvasHtml(document);
}

export default function CompiledEmailPreview({
  title = 'Email editor',
  iframeRef,
  onLoad,
  editorHeadInjection,
  htmlSource = 'editor-canvas',
}: CompiledEmailPreviewProps) {
  const document = useDocument() as TEmailBuilderDocument;
  const html = useMemo(
    () => buildHtmlCodePreviewDocument(document, { htmlSource }),
    [document, htmlSource]
  );

  return (
    <ImportedHtmlPreviewFrame
      html={html}
      title={title}
      iframeRef={iframeRef}
      onLoad={onLoad}
      editorHeadInjection={editorHeadInjection}
    />
  );
}
