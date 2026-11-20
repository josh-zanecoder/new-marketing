/** Same-origin flyer binary URL (inline PDF/image for native browser viewer + print). */
export function buildFlyerFileUrl(flyerId: string): string {
  const id = String(flyerId ?? '').trim()
  if (!id) return ''
  return `/api/v1/tenant/flyers/${encodeURIComponent(id)}/file`
}

/** Admin same-origin flyer binary (includes soft-deleted docs for trash preview). */
export function buildAdminFlyerFileUrl(tenantId: string, flyerId: string): string {
  const tid = String(tenantId ?? '').trim()
  const id = String(flyerId ?? '').trim()
  if (!tid || !id) return ''
  return `/api/v1/admin/tenants/${encodeURIComponent(tid)}/flyers/${encodeURIComponent(id)}/file`
}
