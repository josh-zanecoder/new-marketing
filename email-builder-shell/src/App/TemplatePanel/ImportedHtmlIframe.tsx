import React, { useMemo } from 'react';

import { getCanonicalEmailHtml, type TEmailBuilderDocument } from '../../utils/exportEmailHtml';

import ImportedHtmlPreviewFrame from './ImportedHtmlPreviewFrame';

type ImportedHtmlIframeProps = {
  document: TEmailBuilderDocument;
  title: string;
};

/** @deprecated Prefer CompiledEmailPreview */
export default function ImportedHtmlIframe({ document, title }: ImportedHtmlIframeProps) {
  const html = useMemo(() => getCanonicalEmailHtml(document), [document]);
  return <ImportedHtmlPreviewFrame html={html} title={title} />;
}
