import type { TEditorBlock, TEditorConfiguration } from '../documents/editor/core';

import { extractBodyAttributes, extractHeadFragmentsFromHtml } from './extractHeadFragments';
import { collectFontNamesFromCssValues, extractFontFamiliesFromHeadFragments } from './extractImportedFonts';
import { IMPORT_META_DOCUMENT_KEY, readImportMeta, type EditableBlockMapping, type ImportMetaDocumentEntry } from './exportEmailHtml';
import type { ImportedBlockStyleOverride } from './importedBlockOverrides';
import { mergeImportedBlockStyle } from './importedBlockOverrides';
import {
  applyImportedBlockStyle,
  buttonSizeToFontSize,
  headingLevelFromTag,
  inferButtonSizeFromFontSize,
  inferButtonStyleFromCss,
  mergeInlineStyle,
  parseCssDeclarations,
  readBlockContainerPad,
  readImportedBlockStyle,
  readImportedRichTextStyle,
} from './importedBlockStyleSync';
import {
  buildImportedContentProps,
  hasRichInlineFormatting,
  resolveBlockInnerHtml,
  type ImportedBlockContentProps,
} from './importedInlineContent';
import { containsMergeTags, normalizeMergeTagAttributeHtml, repairMergeTagAnchorsForSend } from './mergeTagText';
import { replaceDocumentBodyInnerHtml, storeImportedFullDocumentHtml } from '@shared/utils/storeImportedFullDocument';

const MAX_HTML_BYTES = 2_000_000;
const EDITABLE_BLOCK_CLASS =
  /(?:^|\s)(heading_block|paragraph_block|image_block|button_block|divider_block|spacer_block)(?:\s|$)/;

export type EditableBlockTarget = {
  markerId: string;
};

function createBlockId(): string {
  return `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function createMarkerId(): string {
  return `eb-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function normalizeImportedEmailHtml(raw: string): string {
  const html = raw.trim();
  if (!html) throw new Error('HTML is empty');
  if (html.length > MAX_HTML_BYTES) throw new Error('HTML is too large (max 2MB)');
  return html;
}

function isEditableBlockElement(el: Element): boolean {
  const className = typeof el.className === 'string' ? el.className : '';
  return EDITABLE_BLOCK_CLASS.test(className);
}

/** Beefree mobile-only duplicate rows (`.desktop_hide`) — edited via the desktop-visible twin. */
function isInsideResponsiveDuplicateRow(el: Element): boolean {
  let cur: Element | null = el;
  while (cur && cur.tagName.toLowerCase() !== 'body') {
    const cls = typeof cur.className === 'string' ? cur.className : '';
    if (/\bdesktop_hide\b/.test(cls)) return true;
    if (cur.tagName.toLowerCase() === 'table') {
      const style = cur.getAttribute('style')?.toLowerCase() ?? '';
      if (/display\s*:\s*none/.test(style) && /max-height\s*:\s*0/.test(style)) return true;
      if (/mso-hide\s*:\s*all/.test(style) && /display\s*:\s*none/.test(style)) return true;
    }
    cur = cur.parentElement;
  }
  return false;
}

function findEditableBlockElements(body: HTMLElement): Element[] {
  const found: Element[] = [];
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as Element | null;
  while (node) {
    if (isEditableBlockElement(node) && !isInsideResponsiveDuplicateRow(node)) {
      found.push(node);
    }
    node = walker.nextNode() as Element | null;
  }
  return found;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function headingSignature(el: Element): string | null {
  const heading = el.querySelector('h1,h2,h3,h4,h5,h6');
  if (!heading) return null;
  const level = heading.tagName.toLowerCase();
  const text = stripTags(heading.innerHTML);
  if (!text) return null;
  return `heading:${level}:${text.toLowerCase()}`;
}

function paragraphSignature(el: Element): string | null {
  const div = el.querySelector('div') ?? el.querySelector('td.pad');
  const text = stripTags(div?.innerHTML ?? el.innerHTML);
  if (!text) return null;
  return `text:${text.toLowerCase().slice(0, 200)}`;
}

function imageSignature(el: Element): string | null {
  const img = el.querySelector('img');
  if (!img?.getAttribute('src')) return null;
  return `image:${img.getAttribute('src')}`;
}

function buttonSignature(el: Element): string | null {
  const a = el.querySelector('a');
  const label = stripTags(el.textContent ?? '');
  const href = a?.getAttribute('href') ?? '';
  if (!label) return null;
  return `button:${label.toLowerCase()}:${href}`;
}

function spacerSignature(el: Element): string | null {
  const style = (el as HTMLElement).getAttribute('style') ?? '';
  const match = style.match(/height:\s*(\d+)px/i);
  if (!match) return null;
  return `spacer:${match[1]}`;
}

function dividerSignature(el: Element): string | null {
  const inner = el.querySelector('.divider_inner');
  if (!inner) return null;
  return `divider:${(inner.getAttribute('style') ?? '').replace(/\s+/g, '')}`;
}

function blockSignature(el: Element): string | null {
  const className = typeof el.className === 'string' ? el.className : '';
  if (className.includes('heading_block')) return headingSignature(el);
  if (className.includes('paragraph_block')) return paragraphSignature(el);
  if (className.includes('image_block')) return imageSignature(el);
  if (className.includes('button_block')) return buttonSignature(el);
  if (className.includes('spacer_block')) return spacerSignature(el);
  if (className.includes('divider_block')) return dividerSignature(el);
  return null;
}

function parseHeadingBlock(el: Element): TEditorBlock | null {
  const heading = el.querySelector('h1,h2,h3,h4,h5,h6');
  if (!heading) return null;
  const rawHtml = normalizeMergeTagAttributeHtml(heading.innerHTML).trim();
  if (!rawHtml) return null;
  if (/<a\b/i.test(rawHtml) && !containsMergeTags(rawHtml)) return null;

  const contentProps = buildImportedContentProps(rawHtml);
  if (!contentProps.text && !contentProps.contentHtml) return null;

  const padEl = readBlockContainerPad(el);
  const padPadding = readImportedBlockStyle(padEl).padding;
  const importedStyle = readImportedRichTextStyle(heading as HTMLElement);
  return {
    type: 'Heading',
    data: {
      props: { ...contentProps, level: headingLevelFromTag(heading.tagName) },
      style: {
        padding: padPadding ?? importedStyle.padding ?? null,
        ...importedStyle,
      },
    },
  };
}

function parseParagraphBlock(el: Element): TEditorBlock | null {
  const div = el.querySelector('div') ?? el.querySelector('td.pad');
  const paragraphs = div ? Array.from(div.querySelectorAll(':scope > p, :scope > div > p')) : [];
  let sourceHtml = '';
  if (paragraphs.length > 1) {
    sourceHtml = paragraphs.map((p) => p.innerHTML).join('<br>');
  } else {
    const p = div?.querySelector('p');
    sourceHtml = p?.innerHTML ?? div?.innerHTML ?? el.innerHTML;
  }
  const contentProps = buildImportedContentProps(sourceHtml);
  if (!contentProps.text && !contentProps.contentHtml) return null;

  const styleEl = (div?.querySelector('p') ?? div ?? el) as HTMLElement;
  const padEl = readBlockContainerPad(el);
  const padPadding = readImportedBlockStyle(padEl).padding;
  const importedStyle = readImportedRichTextStyle(styleEl);
  return {
    type: 'Text',
    data: {
      props: contentProps,
      style: {
        padding: padPadding ?? importedStyle.padding ?? null,
        fontWeight: importedStyle.fontWeight ?? 'normal',
        ...importedStyle,
      },
    },
  };
}

function parseImageBlock(el: Element): TEditorBlock | null {
  const img = el.querySelector('img');
  const url = img?.getAttribute('src')?.trim();
  if (!url) return null;
  const widthAttr = img?.getAttribute('width');
  const heightAttr = img?.getAttribute('height');
  const width = widthAttr ? Number.parseInt(widthAttr, 10) : undefined;
  const height = heightAttr ? Number.parseInt(heightAttr, 10) : undefined;
  return {
    type: 'Image',
    data: {
      props: {
        url,
        alt: img?.getAttribute('alt') ?? '',
        contentAlignment: 'middle',
        linkHref: null,
        ...(Number.isFinite(width) ? { width } : {}),
        ...(Number.isFinite(height) ? { height } : {}),
      },
      style: { padding: null },
    },
  };
}

function parseButtonBlock(el: Element): TEditorBlock | null {
  const a = el.querySelector('a');
  const url = a?.getAttribute('href')?.trim() ?? '#';
  const buttonEl = el.querySelector('.button') as HTMLElement | null;
  const text = stripTags(buttonEl?.textContent ?? el.textContent ?? '') || 'Button';
  const css = parseCssDeclarations(buttonEl?.getAttribute('style') ?? '');
  const importedStyle = readImportedBlockStyle(buttonEl);
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

function parseSpacerBlock(el: Element): TEditorBlock | null {
  const style = (el as HTMLElement).getAttribute('style') ?? '';
  const match = style.match(/height:\s*(\d+)px/i);
  const height = match ? Number.parseInt(match[1], 10) : 24;
  return {
    type: 'Spacer',
    data: {
      props: { height },
    },
  };
}

function parseDividerBlock(el: Element): TEditorBlock | null {
  const inner = el.querySelector('.divider_inner');
  const style = inner?.getAttribute('style') ?? '';
  const colorMatch = style.match(/border-top:\s*[^#]*?(#[0-9a-fA-F]{3,8})/);
  return {
    type: 'Divider',
    data: {
      props: { lineColor: colorMatch?.[1] ?? '#CCCCCC' },
      style: { padding: null },
    },
  };
}

function blockTypeToMappingKind(type: string): EditableBlockMapping['kind'] | null {
  switch (type) {
    case 'Heading':
      return 'heading';
    case 'Text':
      return 'text';
    case 'Image':
      return 'image';
    case 'Button':
      return 'button';
    case 'Spacer':
      return 'spacer';
    case 'Divider':
      return 'divider';
    default:
      return null;
  }
}

function parseNativeBlock(el: Element): TEditorBlock | null {
  const className = typeof el.className === 'string' ? el.className : '';
  if (className.includes('heading_block')) return parseHeadingBlock(el);
  if (className.includes('paragraph_block')) return parseParagraphBlock(el);
  if (className.includes('image_block')) return parseImageBlock(el);
  if (className.includes('button_block')) return parseButtonBlock(el);
  if (className.includes('spacer_block')) return parseSpacerBlock(el);
  if (className.includes('divider_block')) return parseDividerBlock(el);
  return null;
}

function extractBlockStyleOverrides(
  el: Element,
  kind: EditableBlockMapping['kind']
): ImportedBlockStyleOverride {
  const padEl = readBlockContainerPad(el);
  const padPadding = readImportedBlockStyle(padEl).padding;

  if (kind === 'heading') {
    const heading = el.querySelector('h1,h2,h3,h4,h5,h6') as HTMLElement | null;
    return { ...readImportedRichTextStyle(heading), padding: padPadding ?? null };
  }
  if (kind === 'text') {
    const div = el.querySelector('div') ?? el.querySelector('td.pad');
    const styleEl = (div?.querySelector('p') ?? div ?? el) as HTMLElement;
    return { ...readImportedRichTextStyle(styleEl), padding: padPadding ?? null };
  }
  if (kind === 'button') {
    const buttonEl = el.querySelector('.button') as HTMLElement | null;
    return { ...readImportedBlockStyle(buttonEl), padding: padPadding ?? null };
  }
  if (kind === 'image') {
    return { padding: padPadding ?? null };
  }
  return { padding: padPadding ?? null };
}

function patchHeadingTarget(el: Element, block: TEditorBlock, mergedStyle: ImportedBlockStyleOverride) {
  const props = (block.data as { props?: ImportedBlockContentProps & { level?: 'h1' | 'h2' | 'h3' } }).props;
  const desiredLevel = props?.level ?? 'h2';
  let heading = el.querySelector('h1,h2,h3,h4,h5,h6') as HTMLElement | null;
  if (!heading) return;

  if (heading.tagName.toLowerCase() !== desiredLevel) {
    const replacement = el.ownerDocument.createElement(desiredLevel);
    replacement.innerHTML = heading.innerHTML;
    const existingStyle = heading.getAttribute('style');
    if (existingStyle) replacement.setAttribute('style', existingStyle);
    heading.replaceWith(replacement);
    heading = replacement;
  }

  heading.innerHTML = resolveBlockInnerHtml(props);
  applyImportedBlockStyle(heading, mergedStyle);
  const padEl = readBlockContainerPad(el);
  if (padEl && mergedStyle.padding) applyImportedBlockStyle(padEl, { padding: mergedStyle.padding });
}

function patchParagraphTarget(el: Element, block: TEditorBlock, mergedStyle: ImportedBlockStyleOverride) {
  const div = el.querySelector('div') ?? el.querySelector('td.pad');
  const props = (block.data as { props?: ImportedBlockContentProps }).props;
  if (!div) return;
  const innerHtml = resolveBlockInnerHtml(props);
  const existingP = div.querySelector('p');
  const preservedStyle = existingP?.getAttribute('style')?.trim() || 'margin: 0;';
  div.innerHTML = `<p style="${preservedStyle}">${innerHtml}</p>`;
  const p = div.querySelector('p');
  if (p) applyImportedBlockStyle(p as HTMLElement, mergedStyle);
  const padEl = readBlockContainerPad(el);
  if (padEl && mergedStyle.padding) applyImportedBlockStyle(padEl, { padding: mergedStyle.padding });
}

function patchImageTarget(el: Element, block: TEditorBlock, mergedStyle: ImportedBlockStyleOverride) {
  const img = el.querySelector('img');
  const props = (block.data as {
    props?: { url?: string; alt?: string; width?: number; height?: number };
  }).props;
  if (!img || !props?.url) return;
  img.setAttribute('src', props.url);
  if (props.alt != null) img.setAttribute('alt', props.alt);
  if (props.width != null) img.setAttribute('width', String(props.width));
  else img.removeAttribute('width');
  if (props.height != null) img.setAttribute('height', String(props.height));
  else img.removeAttribute('height');
  const padEl = readBlockContainerPad(el);
  if (padEl && mergedStyle.padding) applyImportedBlockStyle(padEl, { padding: mergedStyle.padding });
}

function patchButtonTarget(el: Element, block: TEditorBlock, mergedStyle: ImportedBlockStyleOverride) {
  const props = (block.data as {
    props?: {
      text?: string;
      url?: string;
      buttonTextColor?: string | null;
      buttonBackgroundColor?: string | null;
      buttonStyle?: 'rectangle' | 'rounded' | 'pill';
      size?: 'x-small' | 'small' | 'medium' | 'large';
    };
  }).props;
  if (!props) return;
  const a = el.querySelector('a');
  if (a && props.url) a.setAttribute('href', props.url);
  const label =
    el.querySelector('.button .btn-pad span') ??
    el.querySelector('.button span span') ??
    el.querySelector('.button span');
  if (label && props.text) label.textContent = props.text;

  const buttonEl = el.querySelector('.button') as HTMLElement | null;
  if (!buttonEl) return;

  const fontSize = mergedStyle.fontSize ?? buttonSizeToFontSize(props.size);
  const borderRadius =
    props.buttonStyle === 'pill' ? '24px' : props.buttonStyle === 'rounded' ? '4px' : '0';

  mergeInlineStyle(buttonEl, {
    color: props.buttonTextColor ?? mergedStyle.color ?? undefined,
    'background-color': props.buttonBackgroundColor ?? mergedStyle.backgroundColor ?? undefined,
    'font-size': fontSize != null ? `${fontSize}px` : undefined,
    'border-radius': props.buttonStyle ? borderRadius : undefined,
    'font-family': mergedStyle.fontFamilyCss ?? undefined,
  });

  const padEl = readBlockContainerPad(el);
  if (padEl && mergedStyle.padding) applyImportedBlockStyle(padEl, { padding: mergedStyle.padding });
}

function patchSpacerTarget(el: Element, block: TEditorBlock) {
  const height = (block.data as { props?: { height?: number } }).props?.height ?? 24;
  (el as HTMLElement).setAttribute('style', `height:${height}px;line-height:${height}px;font-size:1px;`);
}

function patchDividerTarget(el: Element, block: TEditorBlock) {
  const color = (block.data as { props?: { lineColor?: string } }).props?.lineColor;
  const inner = el.querySelector('.divider_inner') as HTMLElement | null;
  if (!inner || !color) return;
  inner.setAttribute('style', inner.getAttribute('style')?.replace(/#[0-9a-fA-F]{3,8}/, color) ?? `border-top: 2px solid ${color};`);
}

function copyEditableBlockTextContent(from: Element, to: Element): void {
  const className = typeof from.className === 'string' ? from.className : '';
  if (className.includes('heading_block')) {
    const fromHeading = from.querySelector('h1,h2,h3,h4,h5,h6');
    const toHeading = to.querySelector('h1,h2,h3,h4,h5,h6');
    if (fromHeading && toHeading) {
      toHeading.innerHTML = fromHeading.innerHTML;
    }
    return;
  }
  if (className.includes('paragraph_block')) {
    const fromDiv = from.querySelector('div') ?? from.querySelector('td.pad');
    const toDiv = to.querySelector('div') ?? to.querySelector('td.pad');
    if (!fromDiv || !toDiv) return;
    const fromPs = fromDiv.querySelectorAll('p');
    const toPs = toDiv.querySelectorAll('p');
    if (fromPs.length > 0 && fromPs.length === toPs.length) {
      toPs.forEach((toP, index) => {
        toP.innerHTML = fromPs[index]?.innerHTML ?? '';
      });
      return;
    }
    const wrapperStyle = toDiv.getAttribute('style');
    toDiv.innerHTML = fromDiv.innerHTML;
    if (wrapperStyle) toDiv.setAttribute('style', wrapperStyle);
    return;
  }
  if (className.includes('image_block')) {
    const fromImg = from.querySelector('img');
    const toImg = to.querySelector('img');
    if (!fromImg || !toImg) return;
    for (const attr of ['src', 'alt', 'title'] as const) {
      const val = fromImg.getAttribute(attr);
      if (val != null) toImg.setAttribute(attr, val);
      else toImg.removeAttribute(attr);
    }
    return;
  }
  if (className.includes('button_block')) {
    const fromLink = from.querySelector('a');
    const toLink = to.querySelector('a');
    const href = fromLink?.getAttribute('href');
    if (toLink && href) toLink.setAttribute('href', href);
    const fromLabel =
      from.querySelector('.button .btn-pad span') ??
      from.querySelector('.button span span') ??
      from.querySelector('.button span');
    const toLabel =
      to.querySelector('.button .btn-pad span') ??
      to.querySelector('.button span span') ??
      to.querySelector('.button span');
    if (fromLabel && toLabel) toLabel.textContent = fromLabel.textContent;
    return;
  }
  if (className.includes('divider_block')) {
    const fromColor = from.querySelector('.divider_inner')?.getAttribute('style')?.match(/#[0-9a-fA-F]{3,8}/)?.[0];
    const toInner = to.querySelector('.divider_inner') as HTMLElement | null;
    if (fromColor && toInner) {
      toInner.setAttribute(
        'style',
        toInner.getAttribute('style')?.replace(/#[0-9a-fA-F]{3,8}/, fromColor) ??
          `border-top: 2px solid ${fromColor};`
      );
    }
  }
}

/** Copy edited text into Beefree mobile duplicate rows without overwriting mobile layout styles. */
function syncResponsiveDuplicateBlocks(body: HTMLElement, patchedMarkerIds: ReadonlySet<string>): void {
  if (patchedMarkerIds.size === 0) return;

  for (const markerId of patchedMarkerIds) {
    const source = body.querySelector(`[data-eb-id="${markerId}"]`);
    if (!source || !isEditableBlockElement(source)) continue;
    const signature = blockSignature(source);
    if (!signature) continue;

    const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode() as Element | null;
    while (node) {
      if (
        node !== source &&
        isEditableBlockElement(node) &&
        !node.hasAttribute('data-eb-id') &&
        isInsideResponsiveDuplicateRow(node) &&
        blockSignature(node) === signature
      ) {
        copyEditableBlockTextContent(source, node);
      }
      node = walker.nextNode() as Element | null;
    }
  }
}

function patchTargetFromBlock(
  el: Element,
  block: TEditorBlock,
  kind: EditableBlockMapping['kind'],
  mergedStyle: ImportedBlockStyleOverride
) {
  switch (kind) {
    case 'heading':
      patchHeadingTarget(el, block, mergedStyle);
      break;
    case 'text':
      patchParagraphTarget(el, block, mergedStyle);
      break;
    case 'image':
      patchImageTarget(el, block, mergedStyle);
      break;
    case 'button':
      patchButtonTarget(el, block, mergedStyle);
      break;
    case 'spacer':
      patchSpacerTarget(el, block);
      break;
    case 'divider':
      patchDividerTarget(el, block);
      break;
  }
}

export function countEditableBlocksInHtml(raw: string): number {
  const normalized = normalizeImportedEmailHtml(raw);
  const doc = new DOMParser().parseFromString(normalized, 'text/html');
  return findEditableBlockElements(doc.body).length;
}

export function htmlToEditableBlockDocument(html: string): {
  document: TEditorConfiguration;
  htmlBlockId: string;
  mappings: EditableBlockMapping[];
} | null {
  const normalized = normalizeImportedEmailHtml(html);
  const bodyAttributes = extractBodyAttributes(html);
  const doc = new DOMParser().parseFromString(normalized, 'text/html');

  const styleTags: string[] = [];
  for (const styleEl of [...doc.body.querySelectorAll('style')]) {
    styleTags.push(styleEl.outerHTML);
    styleEl.remove();
  }
  const headFragments = [...extractHeadFragmentsFromHtml(html), ...styleTags];

  const elements = findEditableBlockElements(doc.body);
  if (elements.length === 0) return null;

  const childrenIds: string[] = [];
  const mappings: EditableBlockMapping[] = [];
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

  for (const el of elements) {
    const nativeBlock = parseNativeBlock(el);
    if (!nativeBlock) continue;

    const kind = blockTypeToMappingKind(nativeBlock.type);
    if (!kind) continue;

    const markerId = createMarkerId();
    el.setAttribute('data-eb-id', markerId);

    const blockId = createBlockId();
    childrenIds.push(blockId);
    document[blockId] = nativeBlock;
    mappings.push({
      blockId,
      kind,
      targets: [{ markerId }],
    });
  }

  if (mappings.length === 0) return null;

  (document.root.data as { childrenIds: string[] }).childrenIds = childrenIds;

  const blockStyleOverrides: Record<string, ImportedBlockStyleOverride> = {};
  const inlineFontCssValues: string[] = [];

  for (const mapping of mappings) {
    const markerId = mapping.targets[0]?.markerId;
    if (!markerId) continue;
    const el = doc.body.querySelector(`[data-eb-id="${markerId}"]`);
    if (!el) continue;
    const override = extractBlockStyleOverrides(el, mapping.kind);
    blockStyleOverrides[mapping.blockId] = override;
    if (override.fontFamilyCss) inlineFontCssValues.push(override.fontFamilyCss);
  }

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
      mode: 'editable-blocks',
      passthrough: false,
      headFragments,
      bodyAttributes,
      templateBodyHtml: doc.body.innerHTML,
      blockMappings: mappings,
      blockStyleOverrides,
      detectedFonts,
      originalFullDocumentHtml,
      fullDocumentHtml: originalFullDocumentHtml,
    },
  };

  return { document, htmlBlockId: childrenIds[0], mappings };
}

export function mergeEditableBlocksIntoTemplate(document: TEditorConfiguration): string {
  return mergeEditableBlocksResult(document).fullHtml;
}

export function mergeEditableBlocksResult(document: TEditorConfiguration): {
  fullHtml: string;
  patchedTemplateBodyHtml: string;
} {
  const meta = (document as TEditorConfiguration & Record<string, ImportMetaDocumentEntry>)[
    IMPORT_META_DOCUMENT_KEY
  ]?.data;
  if (!meta?.templateBodyHtml || meta.mode !== 'editable-blocks') {
    throw new Error('Missing editable-blocks import metadata');
  }

  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${meta.templateBodyHtml}</body></html>`,
    'text/html'
  );

  const emailDocument = document as TEditorConfiguration & Record<string, ImportMetaDocumentEntry>;
  const patchedMarkerIds = new Set<string>();

  for (const mapping of meta.blockMappings ?? []) {
    const block = document[mapping.blockId] as TEditorBlock | undefined;
    if (!block) continue;
    const mergedStyle = mergeImportedBlockStyle(emailDocument, mapping.blockId, block);
    for (const target of mapping.targets) {
      const el = doc.body.querySelector(`[data-eb-id="${target.markerId}"]`);
      if (el) {
        patchTargetFromBlock(el, block, mapping.kind, mergedStyle);
        patchedMarkerIds.add(target.markerId);
      }
    }
  }

  syncResponsiveDuplicateBlocks(doc.body, patchedMarkerIds);

  const patchedTemplateBodyHtml = repairMergeTagAnchorsForSend(doc.body.innerHTML);
  const headFragments = meta.headFragments ?? [];
  const hasViewport = headFragments.some((tag) => /name=["']viewport["']/i.test(tag));
  const hasCharset = headFragments.some((tag) => /<meta\b[^>]*charset/i.test(tag));
  const headParts = [
    ...(hasCharset ? [] : ['<meta charset="UTF-8">']),
    ...(hasViewport ? [] : ['<meta name="viewport" content="width=device-width, initial-scale=1.0">']),
    ...headFragments,
  ];
  const bodyOpen = meta.bodyAttributes?.trim() ? `<body ${meta.bodyAttributes}>` : '<body>';
  const rebuilt = `<!DOCTYPE html><html lang="en"><head>${headParts.join('')}</head>${bodyOpen}${patchedTemplateBodyHtml}</body></html>`;

  const shellHtml = meta.originalFullDocumentHtml?.trim() || meta.fullDocumentHtml?.trim() || '';
  const fullHtml = repairMergeTagAnchorsForSend(
    shellHtml
      ? replaceDocumentBodyInnerHtml(shellHtml, patchedTemplateBodyHtml)
      : rebuilt
  );

  return { fullHtml, patchedTemplateBodyHtml };
}

/** Backfill contentHtml on saved imports so inline formatting survives merge/export. */
export function enrichImportedBlockContentFromTemplate(document: TEditorConfiguration): TEditorConfiguration {
  const meta = readImportMeta(document as TEditorConfiguration & Record<string, unknown>);
  if (meta?.mode !== 'editable-blocks' || !meta.templateBodyHtml) return document;

  const templateDoc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${meta.templateBodyHtml}</body></html>`,
    'text/html'
  );

  let changed = false;
  const next: TEditorConfiguration = { ...document };

  for (const mapping of meta.blockMappings ?? []) {
    if (mapping.kind !== 'text' && mapping.kind !== 'heading') continue;

    const block = document[mapping.blockId] as TEditorBlock | undefined;
    if (!block) continue;

    const props = (block.data as { props?: ImportedBlockContentProps }).props;
    if (props?.contentHtml?.trim()) continue;
    if (containsMergeTags(props?.text ?? '')) continue;

    const markerId = mapping.targets[0]?.markerId;
    if (!markerId) continue;
    const el = templateDoc.body.querySelector(`[data-eb-id="${markerId}"]`);
    if (!el) continue;

    let sourceHtml = '';
    if (mapping.kind === 'heading') {
      sourceHtml = el.querySelector('h1,h2,h3,h4,h5,h6')?.innerHTML ?? '';
    } else {
      const div = el.querySelector('div') ?? el.querySelector('td.pad');
      sourceHtml = div?.querySelector('p')?.innerHTML ?? div?.innerHTML ?? '';
    }

    if (!hasRichInlineFormatting(sourceHtml)) continue;

    const contentProps = buildImportedContentProps(sourceHtml);
    next[mapping.blockId] = {
      ...block,
      data: {
        ...block.data,
        props: { ...props, ...contentProps },
      },
    };
    changed = true;
  }

  return changed ? next : document;
}
