/** Same-origin flyer binary URL (inline PDF/image for native browser viewer + print). */
export function buildFlyerFileUrl(flyerId: string): string {
  const id = String(flyerId ?? '').trim()
  if (!id) return ''
  return `/api/v1/tenant/flyers/${encodeURIComponent(id)}/file`
}
