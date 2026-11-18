/** True when the name looks like a GCS upload key (`timestamp-uuid.ext`), not an original file. */
export function isGeneratedFlyerObjectFileName(fileName: string): boolean {
  const name = String(fileName ?? '').trim()
  if (!name) return false
  return /^\d{10,}-[0-9a-f]{8,}[^/]*$/i.test(name)
}
