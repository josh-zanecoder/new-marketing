/**
 * Who may list / delete hosted tenant images (GCS `custom-marketing/{tenant}/…`).
 *
 * Images are private to the uploader (and anyone in their CRM owner scope, e.g. manager
 * downline). Explicitly shared images (`visibility=shared`) are visible to every user in
 * the same tenant. Sessions never get a “see every private image in the tenant” pass —
 * that prevented LO isolation when CRM handoff set `tenantWideContacts`.
 */

/** GCS custom metadata value marking an image as shared with the whole tenant. */
export const HOSTED_IMAGE_VISIBILITY_SHARED = 'shared'

/** Custom metadata stored on each uploaded GCS object. */
export type HostedImageOwnership = {
  ownerEmail?: string
  visibility?: string
  uploadedBy?: string
}

/**
 * Emails whose private images this session may see/delete.
 * Empty → shared images only (no private library).
 */
export type HostedImageViewer = {
  ownerEmails: string[]
}

function normalizedOwner(meta: HostedImageOwnership | null | undefined): string {
  return String(meta?.ownerEmail ?? '').trim().toLowerCase()
}

function normalizedUploadedBy(meta: HostedImageOwnership | null | undefined): string {
  return String(meta?.uploadedBy ?? '').trim().toLowerCase()
}

function isSharedHostedImage(meta: HostedImageOwnership | null | undefined): boolean {
  return String(meta?.visibility ?? '').trim() === HOSTED_IMAGE_VISIBILITY_SHARED
}

/**
 * Untagged (legacy) images stay out of owner-scoped libraries so personal uploads from
 * before ownership tagging do not leak across users.
 */
export function canViewHostedImage(
  meta: HostedImageOwnership | null | undefined,
  viewer: HostedImageViewer
): boolean {
  if (isSharedHostedImage(meta)) return true
  const owner = normalizedOwner(meta)
  return Boolean(owner) && viewer.ownerEmails.includes(owner)
}

/**
 * Delete only when the session owns the image (owner or original uploader in scope).
 * Shared library images are deletable by the uploader’s scope, not by every tenant user.
 */
export function canDeleteHostedImage(
  meta: HostedImageOwnership | null | undefined,
  viewer: HostedImageViewer
): boolean {
  const owner = normalizedOwner(meta)
  if (owner && viewer.ownerEmails.includes(owner)) return true
  const uploadedBy = normalizedUploadedBy(meta)
  return Boolean(uploadedBy) && viewer.ownerEmails.includes(uploadedBy)
}

/** Why an uploaded image cannot be deleted yet; empty when nothing uses it. */
export function hostedImageInUseMessage(usage: {
  visibleTemplateNames: string[]
  otherCount: number
}): string {
  const names = usage.visibleTemplateNames
  const total = names.length + Math.max(0, usage.otherCount)
  if (!total) return ''
  const shown = names.slice(0, 3).map((n) => `"${n}"`)
  const rest = total - shown.length
  const parts = rest > 0
    ? [...shown, `${rest} other ${rest === 1 ? 'template or campaign' : 'templates or campaigns'}`]
    : shown
  const list = parts.length > 1
    ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
    : parts[0]
  return `This image is still used in ${list}. Remove it from there first so those emails don't show a broken image.`
}

/** Read ownership fields from GCS `file.metadata.metadata` (values may be non-strings). */
export function hostedImageOwnershipFromGcsMetadata(raw: unknown): HostedImageOwnership {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  // GCS / XML paths may normalize key case; match case-insensitively.
  const pick = (key: string) => {
    if (typeof r[key] === 'string') return r[key] as string
    const lower = key.toLowerCase()
    for (const [k, v] of Object.entries(r)) {
      if (k.toLowerCase() === lower && typeof v === 'string') return v
    }
    return undefined
  }
  return {
    ownerEmail: pick('ownerEmail'),
    visibility: pick('visibility'),
    uploadedBy: pick('uploadedBy')
  }
}
