/**
 * Registry `clients.grapesBuilderUrl` — optional override for the Grapes iframe.
 * Empty/missing → same-origin `/grapes-builder/` (or env `NUXT_PUBLIC_GRAPES_BUILDER_URL`).
 */
export function parseGrapesBuilderUrl(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  if (!/^https?:\/\/.+/i.test(trimmed)) return null
  return trimmed
}

/** Normalize admin input: blank → null; invalid → throw via caller. */
export function normalizeGrapesBuilderUrlInput(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s) return null
  const parsed = parseGrapesBuilderUrl(s)
  if (!parsed) {
    throw new Error('Grapes builder URL must start with http:// or https://')
  }
  return parsed
}
