/**
 * Who may list / delete hosted tenant images (GCS `custom-marketing/{tenant}/…`).
 * Mirrors email-template ownership: owner-scoped sessions see shared images plus images
 * owned by someone in their scope; tenant-wide sessions see every image in the tenant.
 */

/** GCS custom metadata value marking an image uploaded by a tenant-wide session. */
export const HOSTED_IMAGE_VISIBILITY_SHARED = 'shared'

/** Custom metadata stored on each uploaded GCS object. */
export type HostedImageOwnership = {
  ownerEmail?: string
  visibility?: string
  uploadedBy?: string
}

/** `ownerEmails: null` → tenant-wide (no filter); `[]` → shared images only. */
export type HostedImageViewer = {
  ownerEmails: string[] | null
}

function normalizedOwner(meta: HostedImageOwnership | null | undefined): string {
  return String(meta?.ownerEmail ?? '').trim().toLowerCase()
}

/**
 * Untagged (legacy) images have no owner record, so only tenant-wide sessions see them.
 */
export function canViewHostedImage(
  meta: HostedImageOwnership | null | undefined,
  viewer: HostedImageViewer
): boolean {
  if (viewer.ownerEmails === null) return true
  if (String(meta?.visibility ?? '').trim() === HOSTED_IMAGE_VISIBILITY_SHARED) return true
  const owner = normalizedOwner(meta)
  return Boolean(owner) && viewer.ownerEmails.includes(owner)
}

/** Owner-scoped sessions may only delete images owned by someone in their scope. */
export function canDeleteHostedImage(
  meta: HostedImageOwnership | null | undefined,
  viewer: HostedImageViewer
): boolean {
  if (viewer.ownerEmails === null) return true
  const owner = normalizedOwner(meta)
  return Boolean(owner) && viewer.ownerEmails.includes(owner)
}

/** Read ownership fields from GCS `file.metadata.metadata` (values may be non-strings). */
export function hostedImageOwnershipFromGcsMetadata(raw: unknown): HostedImageOwnership {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const pick = (key: string) => (typeof r[key] === 'string' ? (r[key] as string) : undefined)
  return {
    ownerEmail: pick('ownerEmail'),
    visibility: pick('visibility'),
    uploadedBy: pick('uploadedBy')
  }
}
