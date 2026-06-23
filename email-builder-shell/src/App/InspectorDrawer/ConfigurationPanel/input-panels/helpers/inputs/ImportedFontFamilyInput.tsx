import React, { useMemo, useState } from 'react';

import { MenuItem, TextField } from '@mui/material';

import { buildFontFamilyCss, primaryFontNameFromCss } from '../../../../../../utils/extractImportedFonts';

type ImportedFontFamilyInputProps = {
  label: string;
  defaultValue: string | null | undefined;
  detectedFonts: string[];
  onChange: (fontFamilyCss: string | null) => void;
};

export default function ImportedFontFamilyInput({
  label,
  defaultValue,
  detectedFonts,
  onChange,
}: ImportedFontFamilyInputProps) {
  const initialPrimary = primaryFontNameFromCss(defaultValue ?? undefined) ?? '';
  const [value, setValue] = useState(initialPrimary);

  const options = useMemo(() => {
    const merged = new Set<string>(detectedFonts);
    if (initialPrimary) merged.add(initialPrimary);
    return Array.from(merged).sort((a, b) => a.localeCompare(b));
  }, [detectedFonts, initialPrimary]);

  return (
    <TextField
      select
      variant="standard"
      label={label}
      helperText="Fonts from your imported HTML CDN are listed here."
      value={value}
      onChange={(ev) => {
        const next = ev.target.value;
        setValue(next);
        onChange(next ? buildFontFamilyCss(next) : null);
      }}
      fullWidth
    >
      <MenuItem value="">Keep original font</MenuItem>
      {options.map((font) => (
        <MenuItem key={font} value={font} sx={{ fontFamily: buildFontFamilyCss(font) }}>
          {font}
        </MenuItem>
      ))}
    </TextField>
  );
}
