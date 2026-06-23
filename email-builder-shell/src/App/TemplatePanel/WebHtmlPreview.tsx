import React from 'react';

import CompiledEmailPreview from './CompiledEmailPreview';

type WebHtmlPreviewProps = {
  title?: string;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  onLoad?: () => void;
  editorHeadInjection?: string;
  htmlSource?: 'preview' | 'editor-canvas';
};

/** Renders the canonical HTML in a browser iframe (web preview). */
export default function WebHtmlPreview({
  title = 'Web preview',
  iframeRef,
  onLoad,
  editorHeadInjection,
  htmlSource = 'preview',
}: WebHtmlPreviewProps) {
  return (
    <CompiledEmailPreview
      title={title}
      iframeRef={iframeRef}
      onLoad={onLoad}
      editorHeadInjection={editorHeadInjection}
      htmlSource={htmlSource}
    />
  );
}
