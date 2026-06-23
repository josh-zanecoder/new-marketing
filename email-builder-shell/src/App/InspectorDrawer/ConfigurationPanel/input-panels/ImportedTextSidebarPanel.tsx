import React, { useState } from 'react';

import { Typography } from '@mui/material';
import { TextProps } from '@usewaypoint/block-text';

import { mergeTagSafeMarkdownFlag } from '../../../../utils/mergeTagText';
import {
  getImportedBlockEditorContent,
  insertMergeTagIntoBlockContent,
  patchImportedBlockContentProps,
  type ImportedBlockContentProps,
} from '../../../../utils/importedInlineContent';
import { setDocument, useDocument, useSelectedBlockId } from '../../../../documents/editor/EditorContext';
import { readImportMeta } from '../../../../utils/exportEmailHtml';
import {
  mergeImportedBlockStyle,
  readBlockStyleOverride,
  setBlockStyleOverride,
} from '../../../../utils/importedBlockOverrides';
import type { ImportedBlockStyleOverride } from '../../../../utils/importedBlockOverrides';

import BaseSidebarPanel from './helpers/BaseSidebarPanel';
import BooleanInput from './helpers/inputs/BooleanInput';
import MergeTagInsertControls from './helpers/MergeTagInsertControls';
import TextInput from './helpers/inputs/TextInput';
import ImportedFontFamilyInput from './helpers/inputs/ImportedFontFamilyInput';
import FontSizeInput from './helpers/inputs/FontSizeInput';
import FontWeightInput from './helpers/inputs/FontWeightInput';
import PaddingInput from './helpers/inputs/PaddingInput';
import TextAlignInput from './helpers/inputs/TextAlignInput';
import { NullableColorInput } from './helpers/inputs/ColorInput';

type ImportedTextSidebarPanelProps = {
  data: TextProps & { props?: TextProps['props'] & ImportedBlockContentProps };
};

export default function ImportedTextSidebarPanel({ data }: ImportedTextSidebarPanelProps) {
  const document = useDocument();
  const selectedBlockId = useSelectedBlockId();
  if (!selectedBlockId) return null;

  const detectedFonts = readImportMeta(document)?.detectedFonts ?? [];
  const mergedStyle = mergeImportedBlockStyle(document, selectedBlockId, {
    type: 'Text',
    data,
  });

  const update = (patch: {
    props?: TextProps['props'];
    style?: Partial<ImportedBlockStyleOverride>;
  }) => {
    const nextText = patch.props?.text ?? data.props?.text ?? '';
    const nextProps = {
      ...data.props,
      ...patch.props,
      markdown: mergeTagSafeMarkdownFlag(nextText, patch.props?.markdown ?? data.props?.markdown),
    };
    const nextBlockStyle = {
      ...(data.style ?? {}),
      color: patch.style?.color ?? data.style?.color,
      backgroundColor: patch.style?.backgroundColor ?? data.style?.backgroundColor,
      fontSize: patch.style?.fontSize ?? data.style?.fontSize,
      fontWeight: patch.style?.fontWeight ?? data.style?.fontWeight,
      textAlign: patch.style?.textAlign ?? data.style?.textAlign,
      padding: patch.style?.padding ?? data.style?.padding,
    };

    let nextDocument = {
      ...document,
      [selectedBlockId]: {
        type: 'Text' as const,
        data: {
          props: nextProps,
          style: nextBlockStyle,
        },
      },
    };

    const overridePatch: Partial<ImportedBlockStyleOverride> = {};
    if (patch.style?.fontSize != null) overridePatch.fontSize = patch.style.fontSize;
    if (patch.style?.fontFamilyCss !== undefined) overridePatch.fontFamilyCss = patch.style.fontFamilyCss;
    if (patch.style?.padding) overridePatch.padding = patch.style.padding;
    if (patch.style?.color !== undefined) overridePatch.color = patch.style.color;
    if (patch.style?.backgroundColor !== undefined) overridePatch.backgroundColor = patch.style.backgroundColor;
    if (patch.style?.fontWeight !== undefined) overridePatch.fontWeight = patch.style.fontWeight;
    if (patch.style?.textAlign !== undefined) overridePatch.textAlign = patch.style.textAlign;

    if (Object.keys(overridePatch).length > 0) {
      nextDocument = setBlockStyleOverride(nextDocument, selectedBlockId, {
        ...readBlockStyleOverride(document, selectedBlockId),
        ...overridePatch,
      });
    }

    setDocument(nextDocument);
  };

  const [contentRevision, setContentRevision] = useState(0);
  const editorContent = getImportedBlockEditorContent(data.props);
  const hasPreservedFormatting = Boolean(data.props?.contentHtml?.trim());

  return (
    <BaseSidebarPanel title="Text block">
      <MergeTagInsertControls
        helperText="Adds a merge tag to the content field. Tags are filled when each email is sent."
        onInsert={(token) => {
          update({ props: insertMergeTagIntoBlockContent(data.props, token) });
          setContentRevision((n) => n + 1);
        }}
      />
      <TextInput
        key={`${selectedBlockId}-${contentRevision}`}
        label="Content"
        rows={5}
        defaultValue={editorContent}
        onChange={(value) =>
          update({ props: patchImportedBlockContentProps(data.props, value) })
        }
      />
      {hasPreservedFormatting ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Bold, fonts, and links are preserved. Use a line break instead of &lt;p&gt; tags in this field.
        </Typography>
      ) : (
        <BooleanInput
          label="Markdown (GitHub flavored)"
          defaultValue={data.props?.markdown ?? false}
          onChange={(markdown) => update({ props: { ...data.props, markdown } })}
        />
      )}
      <NullableColorInput
        label="Text color"
        defaultValue={mergedStyle.color ?? null}
        onChange={(color) => update({ style: { color } })}
      />
      <NullableColorInput
        label="Background color"
        defaultValue={mergedStyle.backgroundColor ?? null}
        onChange={(backgroundColor) => update({ style: { backgroundColor } })}
      />
      <ImportedFontFamilyInput
        label="Font family"
        defaultValue={mergedStyle.fontFamilyCss}
        detectedFonts={detectedFonts}
        onChange={(fontFamilyCss) => update({ style: { fontFamilyCss } })}
      />
      <FontSizeInput
        label="Font size"
        defaultValue={mergedStyle.fontSize}
        onChange={(fontSize) => update({ style: { fontSize } })}
      />
      <FontWeightInput
        label="Font weight"
        defaultValue={mergedStyle.fontWeight ?? null}
        onChange={(fontWeight) => update({ style: { fontWeight } })}
      />
      <TextAlignInput
        label="Alignment"
        defaultValue={mergedStyle.textAlign ?? null}
        onChange={(textAlign) => update({ style: { textAlign } })}
      />
      <PaddingInput
        label="Padding"
        defaultValue={mergedStyle.padding ?? data.style?.padding ?? null}
        onChange={(padding) => update({ style: { padding } })}
      />
    </BaseSidebarPanel>
  );
}
