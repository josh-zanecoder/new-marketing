import React, { useState } from 'react';
import { ZodError } from 'zod';

import { Alert, Box } from '@mui/material';
import { HtmlProps, HtmlPropsSchema } from '@usewaypoint/block-html';

import { useDocument, useSelectedBlockId } from '../../../../documents/editor/EditorContext';
import { isImportedPassthroughDocument } from '../../../../utils/exportEmailHtml';
import BaseSidebarPanel from './helpers/BaseSidebarPanel';
import TextInput from './helpers/inputs/TextInput';
import MergeTagInsertControls from './helpers/MergeTagInsertControls';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';

type HtmlSidebarPanelProps = {
  data: HtmlProps;
  setData: (v: HtmlProps) => void;
};

function useHtmlSectionLabel(): string | null {
  const document = useDocument();
  const selectedBlockId = useSelectedBlockId();
  if (!selectedBlockId || !isImportedPassthroughDocument(document)) return null;

  const childrenIds = (document.root.data as { childrenIds?: string[] | null })?.childrenIds ?? [];
  const index = childrenIds.indexOf(selectedBlockId);
  if (index < 0) return null;
  if (childrenIds.length === 1) return 'Imported HTML section';
  return `Section ${index + 1} of ${childrenIds.length}`;
}

export default function HtmlSidebarPanel({ data, setData }: HtmlSidebarPanelProps) {
  const [, setErrors] = useState<ZodError | null>(null);
  const selectedBlockId = useSelectedBlockId();
  const contents = data.props?.contents ?? '';
  const sectionLabel = useHtmlSectionLabel();

  const updateData = (d: unknown) => {
    const res = HtmlPropsSchema.safeParse(d);
    if (res.success) {
      setData(res.data);
      setErrors(null);
    } else {
      setErrors(res.error);
    }
  };

  return (
    <BaseSidebarPanel title={sectionLabel ?? 'HTML section'}>
      <Alert severity="info" sx={{ mb: 2 }}>
        Click a section on the canvas to select it. Each highlighted block is part of your imported email
        (header, hero, footer, etc.).
      </Alert>
      <Box sx={{ mb: 2 }}>
        <MergeTagInsertControls
          helperText="Inserts a merge tag into the section HTML below."
          onInsert={(token) => updateData({ ...data, props: { ...data.props, contents: `${contents}${token}` } })}
        />
        <TextInput
          key={selectedBlockId ?? 'html-section'}
          label="Section HTML"
          rows={16}
          defaultValue={contents}
          onChange={(nextContents) => updateData({ ...data, props: { ...data.props, contents: nextContents } })}
        />
      </Box>
      <MultiStylePropertyPanel
        names={['color', 'backgroundColor', 'fontFamily', 'fontSize', 'textAlign', 'padding']}
        value={data.style}
        onChange={(style) => updateData({ ...data, style })}
      />
    </BaseSidebarPanel>
  );
}
