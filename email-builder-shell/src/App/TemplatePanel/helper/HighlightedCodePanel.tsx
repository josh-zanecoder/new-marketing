import React, { useEffect, useState } from 'react';

import { Box } from '@mui/material';

import { html, json } from './highlighters';

type TextEditorPanelProps = {
  type: 'json' | 'html' | 'javascript';
  value: string;
};

export default function HighlightedCodePanel({ type, value }: TextEditorPanelProps) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    switch (type) {
      case 'html':
        html(value).then(setCode);
        return;
      case 'json':
        json(value).then(setCode);
        return;
    }
  }, [setCode, value, type]);

  if (code === null) {
    return null;
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <Box
        component="pre"
        sx={{
          m: 0,
          p: { xs: 1.5, sm: 2, md: 2.5 },
          fontSize: { xs: 11, sm: 12 },
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
        }}
        dangerouslySetInnerHTML={{ __html: code }}
        onClick={(ev) => {
          const s = window.getSelection();
          if (s === null) {
            return;
          }
          s.selectAllChildren(ev.currentTarget);
        }}
      />
    </Box>
  );
}
