import type { TEditorBlock, TEditorConfiguration } from '../documents/editor/core';

import { extractBodyAttributes, extractHeadFragmentsFromHtml } from './extractHeadFragments';
import { collectFontNamesFromCssValues, extractFontFamiliesFromHeadFragments } from './extractImportedFonts';
import { IMPORT_META_DOCUMENT_KEY, type ImportMetaDocumentEntry } from './exportEmailHtml';
import { htmlInlineToTextBlockProps } from './htmlInlineToTextBlock';
import {
  headingLevelFromTag,
  inferButtonSizeFromFontSize,
  inferButtonStyleFromCss,
  parseCssDeclarations,
  readImportedBlockStyle,
} from './importedBlockStyleSync';
import { extractBodyStyleTags } from './parseImportedHtmlSections';
import { storeImportedFullDocumentHtml } from '@shared/utils/storeImportedFullDocument';

const MAX_HTML_BYTES = 2_000_000;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'TITLE', 'HEAD']);
const BEEFREE_BLOCK_CLASS =
  /(?:^|\s)(heading_block|paragraph_block|image_block|button_block|divider_block|spacer_block)(?:\s|$)/;

function createBlockId(): string {
  return `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function normalizeImportedEmailHtml(raw: string): string {
  const html = raw.trim();
  if (!html) throw new Error('HTML is empty');
  if (html.length > MAX_HTML_BYTES) throw new Error('HTML is too large (max 2MB)');
  return html;
}

function extractBodyHtml(raw: string): string {
  const normalized = normalizeImportedEmailHtml(raw);
  if (/<!doctype/i.test(normalized) || /<\s*html[\s>]/i.test(normalized)) {
    const doc = new DOMParser().parseFromString(normalized, 'text/html');
    return doc.body?.innerHTML?.trim() ?? normalized;
  }
  return normalized;
}

function isTrackingPixel(img: HTMLImageElement): boolean {
  const width = Number.parseInt(img.getAttribute('width') ?? '', 10);
  const height = Number.parseInt(img.getAttribute('height') ?? '', 10);
  if (width === 1 && height === 1) return true;
  const style = img.getAttribute('style') ?? '';
  return /(?:^|;|\s)(?:width|height|max-width|max-height)\s*:\s*1px/i.test(style);
}

function isButtonLikeAnchor(el: Element): boolean {
  const className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
  if (/(?:^|\s)(?:button|btn)(?:\s|$)/.test(className)) return true;
  const style = (el.getAttribute('style') ?? '').toLowerCase();
  return (
    /background(?:-color)?\s*:/.test(style) &&
    (/padding\s*:/.test(style) || /border-radius\s*:/.test(style))
  );
}

function isInsideBeefreeBlock(el: Element): boolean {
  let current: Element | null = el;
  while (current) {
    const className = typeof current.className === 'string' ? current.className : '';
    if (BEEFREE_BLOCK_CLASS.test(className)) return true;
    current = current.parentElement;
  }
  return false;
}

function parseHeading(el: Element): TEditorBlock | null {
  const tag = el.tagName.toLowerCase();
  if (!/^h[1-6]$/.test(tag)) return null;
  const props = htmlInlineToTextBlockProps(el.innerHTML);
  if (!props?.text) return null;
  const importedStyle = readImportedBlockStyle(el as HTMLElement);
  return {
    type: 'Heading',
    data: {
      props: { text: props.text, level: headingLevelFromTag(el.tagName) },
      style: {
        padding: importedStyle.padding ?? null,
        ...importedStyle,
      },
    },
  };
}

function parseText(el: Element): TEditorBlock | null {
  const props = htmlInlineToTextBlockProps(el.innerHTML);
  if (!props?.text) return null;
  const importedStyle = readImportedBlockStyle(el as HTMLElement);
  return {
    type: 'Text',
    data: {
      props: { text: props.text, markdown: props.markdown },
      style: {
        padding: importedStyle.padding ?? null,
        fontWeight: importedStyle.fontWeight ?? 'normal',
        ...importedStyle,
      },
    },
  };
}

function parseImage(el: Element): TEditorBlock | null {
  if (el.tagName !== 'IMG') return null;
  const img = el as HTMLImageElement;
  if (isTrackingPixel(img)) return null;
  const url = img.getAttribute('src')?.trim();
  if (!url) return null;
  const widthAttr = img.getAttribute('width');
  const heightAttr = img.getAttribute('height');
  const width = widthAttr ? Number.parseInt(widthAttr, 10) : undefined;
  const height = heightAttr ? Number.parseInt(heightAttr, 10) : undefined;
  return {
    type: 'Image',
    data: {
      props: {
        url,
        alt: img.getAttribute('alt') ?? '',
        contentAlignment: 'middle',
        linkHref: null,
        ...(Number.isFinite(width) ? { width } : {}),
        ...(Number.isFinite(height) ? { height } : {}),
      },
      style: { padding: null },
    },
  };
}

function parseButton(el: Element): TEditorBlock | null {
  if (el.tagName !== 'A') return null;
  if (!isButtonLikeAnchor(el)) return null;
  const url = el.getAttribute('href')?.trim() ?? '#';
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim() || 'Button';
  const css = parseCssDeclarations(el.getAttribute('style') ?? '');
  const importedStyle = readImportedBlockStyle(el as HTMLElement);
  return {
    type: 'Button',
    data: {
      props: {
        text,
        url,
        buttonTextColor: importedStyle.color ?? undefined,
        buttonBackgroundColor: importedStyle.backgroundColor ?? undefined,
        buttonStyle: inferButtonStyleFromCss(css),
        size: inferButtonSizeFromFontSize(importedStyle.fontSize),
      },
      style: { padding: null },
    },
  };
}

function parseDivider(): TEditorBlock {
  return {
    type: 'Divider',
    data: {
      props: { lineColor: '#CCCCCC' },
      style: { padding: null },
    },
  };
}

function parseSpacer(el: Element): TEditorBlock | null {
  const style = (el as HTMLElement).getAttribute('style') ?? '';
  const match = style.match(/height:\s*(\d+)px/i);
  if (!match) return null;
  const text = (el.textContent ?? '').replace(/\s+/g, '');
  if (text.length > 0) return null;
  const height = Number.parseInt(match[1], 10);
  if (!Number.isFinite(height) || height < 4) return null;
  return {
    type: 'Spacer',
    data: {
      props: { height },
    },
  };
}

function tryParseBlock(el: Element): TEditorBlock | null {
  const tag = el.tagName.toLowerCase();
  if (SKIP_TAGS.has(el.tagName)) return null;
  if (isInsideBeefreeBlock(el)) return null;

  if (/^h[1-6]$/.test(tag)) return parseHeading(el);
  if (tag === 'img') return parseImage(el);
  if (tag === 'a') return parseButton(el);
  if (tag === 'hr') return parseDivider();
  if (tag === 'p') return parseText(el);

  if (tag === 'div' || tag === 'td') {
    const spacer = parseSpacer(el);
    if (spacer) return spacer;
    const childElements = Array.from(el.children).filter((child) => !SKIP_TAGS.has(child.tagName));
    if (childElements.length === 0 && (el.textContent ?? '').trim()) {
      return parseText(el);
    }
  }

  return null;
}

function collectGenericBlocks(body: HTMLElement): TEditorBlock[] {
  const blocks: TEditorBlock[] = [];
  const claimed = new WeakSet<Element>();

  const claimSubtree = (el: Element) => {
    claimed.add(el);
    for (const child of Array.from(el.querySelectorAll('*'))) {
      claimed.add(child);
    }
  };

  const walk = (node: Element) => {
    if (claimed.has(node)) return;

    const block = tryParseBlock(node);
    if (block) {
      blocks.push(block);
      claimSubtree(node);
      return;
    }

    for (const child of Array.from(node.children)) {
      walk(child);
    }
  };

  for (const child of Array.from(body.children)) {
    walk(child);
  }

  return blocks;
}

/** Convert arbitrary email HTML into a native EmailBuilder block document (no Html passthrough). */
export function htmlGenericToBlockDocument(html: string): {
  document: TEditorConfiguration;
  htmlBlockId: string;
  blockCount: number;
} | null {
  const rawBody = extractBodyHtml(html);
  const { body: bodyWithoutStyles, styleTags } = extractBodyStyleTags(rawBody);
  const headFragments = [...extractHeadFragmentsFromHtml(html), ...styleTags];
  const bodyAttributes = extractBodyAttributes(html);

  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${bodyWithoutStyles}</body></html>`,
    'text/html'
  );

  const blocks = collectGenericBlocks(doc.body);
  if (blocks.length === 0) return null;

  const childrenIds: string[] = [];
  const document: TEditorConfiguration = {
    root: {
      type: 'EmailLayout',
      data: {
        backdropColor: '#F5F5F5',
        canvasColor: '#FFFFFF',
        textColor: '#262626',
        fontFamily: 'MODERN_SANS',
        childrenIds: [],
      },
    },
  };

  let firstBlockId = '';
  for (const block of blocks) {
    const blockId = createBlockId();
    if (!firstBlockId) firstBlockId = blockId;
    childrenIds.push(blockId);
    document[blockId] = block;
  }

  (document.root.data as { childrenIds: string[] }).childrenIds = childrenIds;

  const inlineFontCssValues = blocks.flatMap((block) => {
    const style = (block.data as { style?: { fontFamily?: string | null } }).style;
    return style?.fontFamily ? [style.fontFamily] : [];
  });

  const detectedFonts = Array.from(
    new Set([
      ...extractFontFamiliesFromHeadFragments(headFragments),
      ...collectFontNamesFromCssValues(inlineFontCssValues),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const originalFullDocumentHtml = storeImportedFullDocumentHtml(html);

  (document as TEditorConfiguration & Record<string, ImportMetaDocumentEntry>)[IMPORT_META_DOCUMENT_KEY] = {
    type: 'ImportMeta',
    data: {
      mode: 'native-blocks',
      passthrough: false,
      headFragments,
      bodyAttributes,
      detectedFonts,
      originalFullDocumentHtml,
    },
  };

  return { document, htmlBlockId: firstBlockId, blockCount: blocks.length };
}
