import React from 'react';

import { Box } from '@mui/material';

import EditableEmailHtmlEditor from '../InspectorDrawer/ConfigurationPanel/EditableEmailHtmlEditor';

export default function HtmlPanel() {
  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <EditableEmailHtmlEditor />
    </Box>
  );
}
