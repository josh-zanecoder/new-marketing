type CssMap = Map<string, string>;

export type ImportedBlockStyle = {
  color?: string | null;
  backgroundColor?: string | null;
  fontSize?: number | null;
  fontWeight?: 'bold' | 'normal' | null;
  textAlign?: 'left' | 'center' | 'right' | null;
  fontFamilyCss?: string | null;
  padding?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  } | null;
};

export function parseCssDeclarations(style: string): CssMap {
  const map: CssMap = new Map();
  for (const part of style.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const value = part.slice(idx + 1).trim();
    if (key && value) map.set(key, value);
  }
  return map;
}

export function normalizeHexColor(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const hex6 = trimmed.match(/#[0-9a-fA-F]{6}\b/);
  if (hex6) return hex6[0].toLowerCase();
  const hex3 = trimmed.match(/#[0-9a-fA-F]{3}\b/);
  if (hex3) {
    const h = hex3[0].slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return null;
}

function parseFontSize(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]+)\s*px/i);
  if (!match) return null;
  const size = Math.round(Number.parseFloat(match[1]));
  return Number.isFinite(size) ? size : null;
}

function parseFontWeight(value: string | undefined): 'bold' | 'normal' | null {
  if (!value) return null;
  if (value === 'bold' || value === 'bolder') return 'bold';
  if (value === 'normal') return 'normal';
  const num = Number.parseInt(value, 10);
  if (Number.isFinite(num)) return num >= 600 ? 'bold' : 'normal';
  return null;
}

function parseTextAlign(value: string | undefined): 'left' | 'center' | 'right' | null {
  if (value === 'left' || value === 'center' || value === 'right') return value;
  return null;
}

function parsePaddingSide(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]+)\s*px/i);
  if (!match) return null;
  const num = Math.round(Number.parseFloat(match[1]));
  return Number.isFinite(num) ? num : null;
}

function parsePadding(css: CssMap): ImportedBlockStyle['padding'] {
  const shorthand = css.get('padding');
  if (shorthand) {
    const parts = shorthand.split(/\s+/).map((part) => parsePaddingSide(part)).filter((v): v is number => v != null);
    if (parts.length === 1) {
      return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
    }
    if (parts.length === 2) {
      return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
    }
    if (parts.length === 3) {
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
    }
    if (parts.length >= 4) {
      return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
    }
  }

  const top = parsePaddingSide(css.get('padding-top'));
  const bottom = parsePaddingSide(css.get('padding-bottom'));
  const left = parsePaddingSide(css.get('padding-left'));
  const right = parsePaddingSide(css.get('padding-right'));
  if (top == null && bottom == null && left == null && right == null) return null;
  return {
    top: top ?? 0,
    bottom: bottom ?? 0,
    left: left ?? 0,
    right: right ?? 0,
  };
}

function parseFontFamily(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

export function readImportedBlockStyle(el: HTMLElement | null): ImportedBlockStyle {
  if (!el) return {};
  const css = parseCssDeclarations(el.getAttribute('style') ?? '');
  return {
    color: normalizeHexColor(css.get('color')),
    backgroundColor: normalizeHexColor(css.get('background-color')),
    fontSize: parseFontSize(css.get('font-size')),
    fontWeight: parseFontWeight(css.get('font-weight')),
    textAlign: parseTextAlign(css.get('text-align')),
    fontFamilyCss: parseFontFamily(css.get('font-family')),
    padding: parsePadding(css),
  };
}

/** Read block typography from container and nested inline spans (Beefree-style). */
export function readImportedRichTextStyle(el: HTMLElement | null): ImportedBlockStyle {
  const base = readImportedBlockStyle(el);
  if (!el) return base;

  const nested = el.querySelector(
    'span[style], strong[style], b[style], em[style], i[style]'
  ) as HTMLElement | null;
  if (!nested) return base;

  const nestedStyle = readImportedBlockStyle(nested);
  return {
    ...base,
    fontFamilyCss: base.fontFamilyCss ?? nestedStyle.fontFamilyCss,
    fontSize: base.fontSize ?? nestedStyle.fontSize,
    fontWeight: base.fontWeight ?? nestedStyle.fontWeight,
    color: base.color ?? nestedStyle.color,
  };
}

export function mergeInlineStyle(el: HTMLElement, updates: Record<string, string | undefined>) {
  const css = parseCssDeclarations(el.getAttribute('style') ?? '');
  for (const [key, value] of Object.entries(updates)) {
    if (!value) css.delete(key);
    else css.set(key, value);
  }
  const next = Array.from(css.entries())
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
  if (next) el.setAttribute('style', next);
  else el.removeAttribute('style');
}

export function applyImportedBlockStyle(el: HTMLElement, style: ImportedBlockStyle | null | undefined) {
  if (!style) return;
  mergeInlineStyle(el, {
    color: style.color ?? undefined,
    'background-color': style.backgroundColor ?? undefined,
    'font-size': style.fontSize != null ? `${style.fontSize}px` : undefined,
    'font-weight': style.fontWeight ?? undefined,
    'text-align': style.textAlign ?? undefined,
    'font-family': style.fontFamilyCss ?? undefined,
  });
  if (style.padding) {
    mergeInlineStyle(el, {
      'padding-top': `${style.padding.top}px`,
      'padding-bottom': `${style.padding.bottom}px`,
      'padding-left': `${style.padding.left}px`,
      'padding-right': `${style.padding.right}px`,
    });
  }
}

export function readBlockContainerPad(el: Element): HTMLElement | null {
  return el.querySelector('td.pad') as HTMLElement | null;
}

export function mergeBlockStyles(
  blockStyle: ImportedBlockStyle | null | undefined,
  override: ImportedBlockStyle | null | undefined
): ImportedBlockStyle {
  return {
    ...(blockStyle ?? {}),
    ...(override ?? {}),
    padding: override?.padding ?? blockStyle?.padding ?? null,
    fontSize: override?.fontSize ?? blockStyle?.fontSize ?? null,
    fontFamilyCss: override?.fontFamilyCss ?? blockStyle?.fontFamilyCss ?? null,
  };
}

export function headingLevelFromTag(tagName: string): 'h1' | 'h2' | 'h3' {
  const tag = tagName.toLowerCase();
  if (tag === 'h1' || tag === 'h2' || tag === 'h3') return tag;
  return 'h3';
}

export function inferButtonStyleFromCss(css: CssMap): 'rectangle' | 'rounded' | 'pill' {
  const radius = css.get('border-radius');
  if (!radius) return 'rectangle';
  const num = Number.parseInt(radius, 10);
  if (Number.isFinite(num) && num >= 20) return 'pill';
  if (Number.isFinite(num) && num > 0) return 'rounded';
  return 'rectangle';
}

export function inferButtonSizeFromFontSize(fontSize: number | null | undefined): 'x-small' | 'small' | 'medium' | 'large' {
  if (!fontSize) return 'medium';
  if (fontSize <= 12) return 'x-small';
  if (fontSize <= 14) return 'small';
  if (fontSize >= 18) return 'large';
  return 'medium';
}

export function buttonSizeToFontSize(size: string | null | undefined): number | undefined {
  switch (size) {
    case 'x-small':
      return 12;
    case 'small':
      return 14;
    case 'large':
      return 18;
    case 'medium':
      return 16;
    default:
      return undefined;
  }
}
