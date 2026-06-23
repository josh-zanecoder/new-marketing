import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Alert, Box, Button, Chip, Stack, TextField, Typography } from '@mui/material';

import {
  replaceDocumentFromEditedHtml,
  useDocument,
} from '../../../documents/editor/EditorContext';
import {
  extractMergeTagsFromHtml,
  validateEditedEmailHtml,
} from '../../../utils/applyEditedEmailHtml';
import { mergeTagToken } from '../../../utils/dynamicVariablesStore';
import { getCanonicalEmailHtml } from '../../../utils/exportEmailHtml';
import MergeTagInsertControls from './input-panels/helpers/MergeTagInsertControls';

type EditableEmailHtmlEditorProps = {
  compact?: boolean;
};

export default function EditableEmailHtmlEditor({ compact = false }: EditableEmailHtmlEditorProps) {
  const document = useDocument();
  const exportedHtml = useMemo(() => getCanonicalEmailHtml(document), [document]);

  const [draft, setDraft] = useState(exportedHtml);
  const [dirty, setDirty] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setDraft(exportedHtml);
    }
  }, [exportedHtml, dirty]);

  const mergeTags = useMemo(() => extractMergeTagsFromHtml(draft), [draft]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertIntoDraft = useCallback((token: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraft((prev) => `${prev}${token}`);
      setDirty(true);
      setApplied(false);
      setApplyError(null);
      return;
    }
    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${token}${draft.slice(end)}`;
    setDraft(next);
    setDirty(true);
    setApplied(false);
    setApplyError(null);
    requestAnimationFrame(() => {
      textarea.focus();
      const caret = start + token.length;
      textarea.setSelectionRange(caret, caret);
    });
  }, [draft]);

  const handleApply = useCallback(() => {
    const validation = validateEditedEmailHtml(draft);
    if (validation.error) {
      setApplyError(validation.error);
      setApplied(false);
      return;
    }
    try {
      replaceDocumentFromEditedHtml(draft);
      setDirty(false);
      setApplyError(null);
      setApplied(true);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Could not apply HTML');
      setApplied(false);
    }
  }, [draft]);

  const handleRevert = useCallback(() => {
    setDraft(exportedHtml);
    setDirty(false);
    setApplyError(null);
    setApplied(false);
  }, [exportedHtml]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pb: 2, height: compact ? 'auto' : '100%' }}>
      <Alert severity="info" sx={{ mx: compact ? 2 : { xs: 1.5, md: 2 }, mt: compact ? 2 : { xs: 1.5, md: 2 } }}>
        This HTML drives the design canvas, preview, and saved output. Edit below, then click{' '}
        <strong>Apply changes</strong> to update what you see everywhere. Merge tags like{' '}
        <Typography component="code" variant="body2" sx={{ fontFamily: 'monospace' }}>
          {'{{unsubscribe}}'}
        </Typography>{' '}
        are replaced when each email is sent.
      </Alert>

      {applyError && (
        <Alert severity="error" sx={{ mx: compact ? 2 : { xs: 1.5, md: 2 } }}>
          {applyError}
        </Alert>
      )}

      {applied && !dirty && !applyError && (
        <Alert severity="success" sx={{ mx: compact ? 2 : { xs: 1.5, md: 2 } }} onClose={() => setApplied(false)}>
          HTML applied — Edit, Preview, and Save now use this exact markup.
        </Alert>
      )}

      {mergeTags.length > 0 && (
        <Box sx={{ px: compact ? 2 : { xs: 1.5, md: 2 } }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Merge tags in this HTML
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {mergeTags.map((tag) => (
              <Chip
                key={tag}
                size="small"
                label={mergeTagToken(tag)}
                variant="outlined"
                onClick={() => insertIntoDraft(mergeTagToken(tag))}
                sx={{ fontFamily: 'monospace', fontSize: 11 }}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Box sx={{ px: compact ? 2 : { xs: 1.5, md: 2 } }}>
        <MergeTagInsertControls
          helperText="Insert tenant dynamic variables into the HTML editor."
          onInsert={insertIntoDraft}
        />
      </Box>

      <Stack
        direction="row"
        spacing={1}
        sx={{ px: compact ? 2 : { xs: 1.5, md: 2 }, flexWrap: 'wrap', useFlexGap: true }}
      >
        <Button variant="contained" size="small" disabled={!dirty} onClick={handleApply}>
          Apply changes
        </Button>
        <Button variant="outlined" size="small" disabled={!dirty} onClick={handleRevert}>
          Revert
        </Button>
        {dirty && (
          <Typography variant="caption" color="warning.main" sx={{ alignSelf: 'center' }}>
            Unsaved HTML edits
          </Typography>
        )}
      </Stack>

      <Box
        sx={{
          px: compact ? 2 : { xs: 1.5, md: 2 },
          flex: compact ? undefined : 1,
          minHeight: compact ? 280 : 0,
        }}
      >
        <TextField
          inputRef={textareaRef}
          multiline
          fullWidth
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setDirty(true);
            setApplied(false);
            setApplyError(null);
          }}
          minRows={compact ? 16 : 24}
          maxRows={compact ? 40 : undefined}
          spellCheck={false}
          placeholder="<!DOCTYPE html>..."
          sx={{
            '& .MuiInputBase-root': {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: compact ? 11 : 12,
              lineHeight: 1.45,
              alignItems: 'flex-start',
            },
            '& textarea': {
              tabSize: 2,
            },
          }}
        />
      </Box>
    </Box>
  );
}
