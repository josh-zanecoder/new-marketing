import React, { useMemo, useState } from 'react';

import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';

import {
  bodyDynamicVariables,
  mergeTagToken,
  useDynamicVariables,
} from '../../../../../utils/dynamicVariablesStore';

type MergeTagInsertControlsProps = {
  onInsert: (token: string) => void;
  helperText?: string;
};

export default function MergeTagInsertControls({ onInsert, helperText }: MergeTagInsertControlsProps) {
  const variables = useDynamicVariables();
  const options = useMemo(() => bodyDynamicVariables(variables), [variables]);
  const [selected, setSelected] = useState('');

  if (!options.length) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        Loading dynamic variables…
      </Typography>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <FormControl fullWidth size="small">
        <InputLabel id="eb-merge-tag-insert-label">Insert variable</InputLabel>
        <Select
          labelId="eb-merge-tag-insert-label"
          value={selected}
          label="Insert variable"
          MenuProps={{
            disableScrollLock: true,
            slotProps: {
              paper: { sx: { zIndex: 1600, maxHeight: 320 } },
            },
          }}
          onChange={(event) => {
            const key = String(event.target.value ?? '').trim();
            if (!key) return;
            onInsert(mergeTagToken(key));
            setSelected('');
          }}
        >
          <MenuItem value="">
            <em>Choose a variable…</em>
          </MenuItem>
          {options.map((variable) => (
            <MenuItem key={variable.key} value={variable.key}>
              {variable.label}{' '}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                ({mergeTagToken(variable.key)})
              </Typography>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
}
