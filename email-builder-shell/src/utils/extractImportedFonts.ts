/** Extract font family names from Google Fonts / stylesheet links in imported HTML head. */
export function extractFontFamiliesFromHeadFragments(headFragments: string[]): string[] {
  const fonts = new Set<string>();

  for (const fragment of headFragments) {
    for (const match of fragment.matchAll(/family=([^&"'<>]+)/gi)) {
      const raw = decodeURIComponent(match[1].replace(/\+/g, ' '));
      for (const part of raw.split('|')) {
        const name = part.split(':')[0]?.trim();
        if (name) fonts.add(name);
      }
    }

    for (const match of fragment.matchAll(/fonts\.googleapis\.com\/css[^"']*family=([^&"']+)/gi)) {
      const raw = decodeURIComponent(match[1].replace(/\+/g, ' '));
      for (const part of raw.split('|')) {
        const name = part.split(':')[0]?.trim();
        if (name) fonts.add(name);
      }
    }
  }

  return Array.from(fonts).sort((a, b) => a.localeCompare(b));
}

export function primaryFontNameFromCss(fontFamilyCss: string | null | undefined): string | null {
  if (!fontFamilyCss?.trim()) return null;
  const first = fontFamilyCss.split(',')[0]?.trim() ?? '';
  return first.replace(/^['"]|['"]$/g, '') || null;
}

export function buildFontFamilyCss(fontName: string): string {
  const trimmed = fontName.trim();
  if (!trimmed) return '';
  const quoted = /['"]/.test(trimmed) ? trimmed : `'${trimmed}'`;
  return `${quoted}, Arial, 'Helvetica Neue', Helvetica, sans-serif`;
}

export function collectFontNamesFromCssValues(values: Array<string | null | undefined>): string[] {
  const fonts = new Set<string>();
  for (const value of values) {
    const primary = primaryFontNameFromCss(value ?? undefined);
    if (primary) fonts.add(primary);
  }
  return Array.from(fonts);
}
