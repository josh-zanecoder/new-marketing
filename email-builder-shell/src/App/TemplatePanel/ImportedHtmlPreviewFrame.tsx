import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Box } from '@mui/material';
import { buildImportedEmailIframeDocument } from '@shared/utils/emailHtmlPreview';
import {
  EMAIL_WEB_VIEW,
  resolveDesktopWebViewWidth,
} from '@shared/utils/emailResponsiveWebView';

import { useSelectedScreenSize } from '../../documents/editor/EditorContext';
import {
  createEmailPreviewBlobUrl,
  revokeEmailPreviewBlobUrl,
} from '../../utils/injectPreviewViewport';

function resolvePreviewWidth(html: string, screenSize: 'mobile' | 'desktop'): number {
  return screenSize === 'mobile'
    ? EMAIL_WEB_VIEW.mobile.width
    : resolveDesktopWebViewWidth(html);
}

type ImportedHtmlPreviewFrameProps = {
  html: string;
  title: string;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
  onLoad?: () => void;
  /** Optional editor bridge injected into `<head>` (edit tab). */
  editorHeadInjection?: string;
};

/** Browser-accurate iframe — applies imported HTML, CSS, JS + preview viewport layers. */
export default function ImportedHtmlPreviewFrame({
  html,
  title,
  iframeRef,
  onLoad,
  editorHeadInjection,
}: ImportedHtmlPreviewFrameProps) {
  const selectedScreenSize = useSelectedScreenSize();
  const localIframeRef = useRef<HTMLIFrameElement>(null);
  const resolvedRef = iframeRef ?? localIframeRef;

  const previewWidth = useMemo(
    () => resolvePreviewWidth(html, selectedScreenSize),
    [html, selectedScreenSize]
  );

  const [iframeSrc, setIframeSrc] = useState('');

  useEffect(() => {
    const prepared = buildImportedEmailIframeDocument(html, {
      previewWidth,
      editorHeadInjection,
    });
    const url = createEmailPreviewBlobUrl(prepared);
    setIframeSrc(url);
    return () => revokeEmailPreviewBlobUrl(url);
  }, [html, previewWidth, editorHeadInjection]);

  const resizeToContent = useCallback(() => {
    const iframe = resolvedRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) return;

    const height = Math.max(
      doc.body.scrollHeight,
      doc.documentElement?.scrollHeight ?? 0,
      320
    );
    iframe.style.height = `${height}px`;
    onLoad?.();
  }, [onLoad, resolvedRef]);

  useEffect(() => {
    resizeToContent();
  }, [html, iframeSrc, resizeToContent]);

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        bgcolor: '#525659',
        py: { xs: 2, sm: 3 },
        px: { xs: 1, sm: 2 },
        overflowX: 'auto',
      }}
    >
      <Box
        sx={{
          width: previewWidth,
          minWidth: previewWidth,
          flexShrink: 0,
          bgcolor: '#525659',
          boxShadow: '0 1px 3px rgba(15, 23, 42, 0.12)',
          overflow: 'visible',
        }}
      >
        <Box
          component="iframe"
          key={`${selectedScreenSize}-${previewWidth}-${editorHeadInjection ? 'edit' : 'view'}`}
          ref={resolvedRef}
          title={title}
          src={iframeSrc || undefined}
          onLoad={resizeToContent}
          scrolling="auto"
          sx={{
            display: 'block',
            width: previewWidth,
            minWidth: previewWidth,
            minHeight: 320,
            border: 0,
            bgcolor: 'white',
            verticalAlign: 'top',
            overflow: 'auto',
          }}
        />
      </Box>
    </Box>
  );
}
