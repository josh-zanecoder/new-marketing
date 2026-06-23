import React, { useRef, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import {
  resetDocument,
  setInspectorDrawerOpen,
  setSelectedBlockId,
  setSelectedMainTab,
  setSidebarTab,
} from '../../../documents/editor/EditorContext';
import {
  convertHtmlToEmailBuilderDocument,
  type HtmlImportConversionMode,
  validateImportedEmailHtml,
} from '../../../utils/importEmailHtml';

type ImportHtmlDialogProps = {
  onClose: () => void;
};

export default function ImportHtmlDialog({ onClose }: ImportHtmlDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const conversionMessage = (mode: HtmlImportConversionMode, blockCount: number): string => {
    switch (mode) {
      case 'editable-blocks':
        return `Converted ${blockCount} Beefree/Stripo-style block${blockCount === 1 ? '' : 's'} into editable EmailBuilder blocks. Click each block in Edit to change content.`;
      case 'native-blocks':
        return `Converted ${blockCount} element${blockCount === 1 ? '' : 's'} (headings, text, images, buttons) into native EmailBuilder blocks.`;
      default:
        return `Could not map content to native blocks — imported as ${blockCount} HTML section${blockCount === 1 ? '' : 's'}. Re-import after updating the converter, or edit sections in the HTML tab.`;
    }
  };

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement> = (ev) => {
    const next = ev.currentTarget.value;
    setValue(next);
    setImportNotice(null);
    const { error: validationError } = validateImportedEmailHtml(next);
    setError(next.trim() ? validationError : null);
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;

    const name = file.name.toLowerCase();
    if (!name.endsWith('.html') && !name.endsWith('.htm') && file.type !== 'text/html') {
      setError('Please choose an .html or .htm file');
      return;
    }

    try {
      const text = await file.text();
      setValue(text);
      const { error: validationError } = validateImportedEmailHtml(text);
      setError(validationError);
    } catch {
      setError('Could not read the HTML file');
    }
  };

  const handleImport = () => {
    const { error: validationError } = validateImportedEmailHtml(value);
    setError(validationError);
    if (validationError || !value.trim()) return;

    const { document, htmlBlockId, mode, blockCount } = convertHtmlToEmailBuilderDocument(value);
    resetDocument(document);
    setImportNotice(conversionMessage(mode, blockCount));
    setSelectedMainTab('editor');
    setSelectedBlockId(htmlBlockId);
    setSidebarTab('block-configuration');
    setInspectorDrawerOpen(true);
    setCompleted(true);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Import HTML</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography color="text.secondary">
            Paste HTML or upload an .html file. Beefree/Stripo templates convert to editable EmailBuilder
            blocks (Heading, Text, Image, Button). Other HTML is scanned for headings, paragraphs, images,
            and buttons and converted when possible. This replaces your current template.
          </Typography>
          {importNotice ? <Alert severity="success">{importNotice}</Alert> : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={() => fileInputRef.current?.click()}>
              Choose HTML file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,.htm,text/html"
              hidden
              onChange={handleFileChange}
            />
          </Stack>
          <TextField
            error={error !== null && value.trim().length > 0}
            value={value}
            onChange={handleChange}
            placeholder="<table>...</table> or full HTML document"
            helperText="Full documents import the body content only."
            variant="outlined"
            fullWidth
            rows={12}
            multiline
            disabled={completed}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        {completed ? (
          <Button variant="contained" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleImport} disabled={!value.trim() || error !== null}>
              Import
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
