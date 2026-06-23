/** Preserve imported email HTML/CSS/JS assets for iframe preview, edit, and export. */

import { extractExternalStylesheetLinks } from './emailPreviewFonts'

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const tag of tags) {
    const key = tag.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(tag)
  }
  return result
}

/** All `<style>` blocks in source (includes MSO conditional comments Beefree uses). */
export function extractStyleTagsFromHtml(html: string): string[] {
  const styles: string[] = []
  for (const match of html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)) {
    const tag = match[0]?.trim()
    if (tag) styles.push(tag)
  }
  return styles
}

/** `<script>` tags inside `<head>`. */
export function extractHeadScriptTagsFromHtml(html: string): string[] {
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)
  if (!headMatch?.[1]) return []

  const scripts: string[] = []
  for (const match of headMatch[1].matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)) {
    const tag = match[0]?.trim()
    if (tag) scripts.push(tag)
  }
  for (const match of headMatch[1].matchAll(/<script\b[^>]*\/>/gi)) {
    const tag = match[0]?.trim()
    if (tag) scripts.push(tag)
  }
  return scripts
}

/** External script src tags anywhere in the document. */
export function extractExternalScriptTagsFromHtml(html: string): string[] {
  const scripts: string[] = []
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>\s*<\/script>/gi)) {
    const tag = match[0]?.trim()
    if (tag) scripts.push(tag)
  }
  for (const match of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*\/>/gi)) {
    const tag = match[0]?.trim()
    if (tag) scripts.push(tag)
  }
  return scripts
}

function headContainsFragment(html: string, fragment: string): boolean {
  const needle = fragment.trim()
  if (!needle) return true
  if (html.includes(needle)) return true

  const href = needle.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]
  if (href && html.includes(href)) return true

  const src = needle.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]
  if (src && html.includes(src)) return true

  const id = needle.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1]
  if (id && html.includes(`id="${id}"`)) return true

  return false
}

function injectBeforeHeadEnd(html: string, injection: string): string {
  if (!injection.trim()) return html
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}</head>`)
  }
  if (/<head\b/i.test(html)) {
    return html.replace(/<head(\b[^>]*)>/i, `<head$1>${injection}`)
  }
  return `<!DOCTYPE html><html lang="en"><head>${injection}</head><body>${html}</body></html>`
}

/**
 * Merge stylesheets, inline styles, and scripts from the source HTML into head fragments
 * (used when rebuilding export documents from blocks).
 */
export function mergeImportHeadAssets(fullHtml: string, existingFragments: string[]): string[] {
  return dedupeTags([
    ...existingFragments,
    ...extractExternalStylesheetLinks(fullHtml),
    ...extractStyleTagsFromHtml(fullHtml),
    ...extractHeadScriptTagsFromHtml(fullHtml),
    ...extractExternalScriptTagsFromHtml(fullHtml),
  ])
}

/**
 * Ensure iframe/export HTML still contains every CSS/JS asset from the import.
 * Only injects tags that appear missing (non-destructive).
 */
export function ensureImportedDocumentAssets(html: string): string {
  const styles = extractStyleTagsFromHtml(html)
  const links = extractExternalStylesheetLinks(html)
  const headScripts = extractHeadScriptTagsFromHtml(html)
  const externalScripts = extractExternalScriptTagsFromHtml(html)

  let result = html
  for (const tag of [...links, ...styles, ...headScripts, ...externalScripts]) {
    if (!headContainsFragment(result, tag)) {
      result = injectBeforeHeadEnd(result, tag)
    }
  }
  return result
}
