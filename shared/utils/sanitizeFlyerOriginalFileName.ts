const FLYER_ORIGINAL_FILE_NAME_MAX = 180

/** Keep a safe original upload file name (not the GCS object key). */
export function sanitizeFlyerOriginalFileName(raw: unknown): string {
  const trimmed = String(raw ?? '').trim().replace(/\0/g, '')
  if (!trimmed) return ''
  const base = trimmed.split(/[/\\]/).pop()?.trim() || ''
  if (!base) return ''
  return base.slice(0, FLYER_ORIGINAL_FILE_NAME_MAX)
}
