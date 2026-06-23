import juice from 'juice'

/**
 * Inline `<style>` CSS into element `style="..."` attributes for email delivery.
 *
 * Inbox clients (notably Gmail) routinely strip `<head>`/`<style>` blocks, which
 * collapses the layout (lost backgrounds, broken grids, both responsive variants
 * shown). Inlining moves the base rules onto each element so they survive, while
 * juice keeps media queries / font-faces in a `<style>` block for clients that
 * support them. Falls back to the original HTML if inlining throws.
 */
export function inlineEmailCss(html: string): string {
  const input = (html ?? '').trim()
  if (!input) return ''
  try {
    return juice(input, {
      preserveImportant: true,
      preserveMediaQueries: true,
      preserveFontFaces: true,
      applyWidthAttributes: true,
      applyHeightAttributes: true
    })
  } catch (err) {
    console.warn('[email] CSS inlining failed; sending non-inlined HTML', err)
    return input
  }
}
