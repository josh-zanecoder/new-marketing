/** Split imported email body HTML into selectable section blocks. */
export function splitHtmlIntoSections(bodyHtml: string): string[] {
  const trimmed = bodyHtml.trim();
  if (!trimmed) return [''];

  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><body>${trimmed}</body></html>`,
    'text/html'
  );
  const body = doc.body;
  const elements = Array.from(body.children).filter((el) => el.outerHTML.trim());

  if (elements.length > 1) {
    return elements.map((el) => el.outerHTML);
  }

  if (elements.length === 1) {
    const only = elements[0];
    if (only.tagName === 'TABLE') {
      const rowSections = splitTableIntoRowSections(only);
      if (rowSections.length > 1) return rowSections;
    }
    if (only.tagName === 'DIV' || only.tagName === 'CENTER') {
      const inner = Array.from(only.children).filter((el) => el.outerHTML.trim());
      if (inner.length > 1) {
        return inner.map((el) => el.outerHTML);
      }
      if (inner.length === 1 && inner[0].tagName === 'TABLE') {
        const rowSections = splitTableIntoRowSections(inner[0]);
        if (rowSections.length > 1) return rowSections;
      }
    }
  }

  return [trimmed];
}

function collectDirectRows(table: Element): Element[] {
  const rows: Element[] = [];
  for (const child of Array.from(table.children)) {
    const tag = child.tagName;
    if (tag === 'TBODY' || tag === 'THEAD' || tag === 'TFOOT') {
      for (const row of Array.from(child.children)) {
        if (row.tagName === 'TR') rows.push(row);
      }
    } else if (tag === 'TR') {
      rows.push(child);
    }
  }
  return rows;
}

function splitTableIntoRowSections(table: Element): string[] {
  const rows = collectDirectRows(table);
  if (rows.length <= 1) return [table.outerHTML];

  const openTagMatch = table.outerHTML.match(/^<table[\s\S]*?>/i);
  const openTag = openTagMatch?.[0] ?? '<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">';

  return rows.map((row) => `${openTag}<tbody>${row.outerHTML}</tbody></table>`);
}

/** Move `<style>` blocks from body markup into head fragments (better client support). */
export function extractBodyStyleTags(bodyHtml: string): { body: string; styleTags: string[] } {
  const styleTags: string[] = [];
  const body = bodyHtml.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (match) => {
    styleTags.push(match);
    return '';
  });
  return { body: body.trim(), styleTags };
}
