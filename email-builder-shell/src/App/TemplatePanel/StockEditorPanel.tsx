import React from 'react';

import { Box } from '@mui/material';

import { useSelectedScreenSize } from '../../documents/editor/EditorContext';
import EditorBlock from '../../documents/editor/EditorBlock';
import { templatePanelMainBoxSx } from '../../utils/templatePanelMainBoxSx';

/** Stock EmailBuilder edit canvas. */
export default function StockEditorPanel() {
  const selectedScreenSize = useSelectedScreenSize();

  return (
    <Box sx={templatePanelMainBoxSx(selectedScreenSize)}>
      <EditorBlock id="root" />
    </Box>
  );
}
