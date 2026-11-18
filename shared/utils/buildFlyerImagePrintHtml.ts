/** Escape a value for use inside a double-quoted HTML attribute. */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Minimal print document for image (non-PDF) flyers.
 * `@page { margin: 0 }` suppresses Chrome date/URL header/footer chrome.
 */
export function buildFlyerImagePrintHtml(input: {
  src: string
  name?: string
}): string {
  const src = escapeHtmlAttr(String(input.src ?? '').trim())
  const alt = escapeHtmlAttr(String(input.name ?? 'Flyer').trim() || 'Flyer')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title></title>
  <style>
    @page { margin: 0; size: auto; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #fff;
    }
    img {
      display: block;
      box-sizing: border-box;
      max-width: 100%;
      max-height: 100vh;
      width: auto;
      height: auto;
      margin: 0 auto;
      border: 0;
      object-fit: contain;
    }
    @media print {
      html, body { height: auto; }
      img {
        max-width: 100%;
        max-height: 100%;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <img src="${src}" alt="${alt}">
</body>
</html>`
}
