import React, { useState } from 'react';

import { HtmlOutlined } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';

import ImportHtmlDialog from './ImportHtmlDialog';

export default function ImportHtml() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title="Import HTML">
        <IconButton onClick={() => setOpen(true)}>
          <HtmlOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
      {open ? <ImportHtmlDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}
