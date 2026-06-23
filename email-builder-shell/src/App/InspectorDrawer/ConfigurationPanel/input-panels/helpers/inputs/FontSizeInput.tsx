import React, { useState } from 'react';

import { TextFieldsOutlined } from '@mui/icons-material';
import { InputLabel, Stack, TextField } from '@mui/material';

import RawSliderInput from './raw/RawSliderInput';

type Props = {
  label: string;
  defaultValue: number | null | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
};

export default function FontSizeInput({
  label,
  defaultValue,
  onChange,
  min = 8,
  max = 200,
}: Props) {
  const initial = defaultValue ?? 16;
  const [value, setValue] = useState(initial);

  const commit = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    setValue(clamped);
    onChange(clamped);
  };

  return (
    <Stack spacing={1} alignItems="flex-start" width="100%">
      <InputLabel shrink>{label}</InputLabel>
      <Stack direction="row" spacing={1} alignItems="center" width="100%">
        <TextField
          type="number"
          size="small"
          value={value}
          inputProps={{ min, max, step: 1 }}
          onChange={(ev) => {
            const parsed = Number.parseInt(ev.target.value, 10);
            if (Number.isFinite(parsed)) commit(parsed);
          }}
          sx={{ width: 88, flexShrink: 0 }}
        />
        <RawSliderInput
          iconLabel={<TextFieldsOutlined sx={{ fontSize: 16 }} />}
          value={Math.min(value, max)}
          setValue={commit}
          units="px"
          step={1}
          min={min}
          max={max}
        />
      </Stack>
    </Stack>
  );
}
