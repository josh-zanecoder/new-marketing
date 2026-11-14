import { tenantUserEmailFromAuth } from '@server/tenant/registry-auth'
import { ownerScopedEmails } from '@server/utils/emailTemplate/emailTemplateOwnership'
import {
  HOSTED_IMAGE_VISIBILITY_SHARED,
  type HostedImageOwnership,
  type HostedImageViewer
} from '~~/shared/hostedImageAccess'

/** Owner-scoped sessions always see their own uploads, even when the handoff scope omits self. */
export function hostedImageViewerFromAuth(auth: unknown): HostedImageViewer {
  const scope = ownerScopedEmails(auth)
  if (scope === null) return { ownerEmails: null }
  const self = tenantUserEmailFromAuth(auth)
  return { ownerEmails: self && !scope.includes(self) ? [...scope, self] : scope }
}

/**
 * GCS custom metadata for a new upload. Owner-scoped users get a private image; tenant-wide
 * users upload shared images.
 */
export function hostedImageOwnershipFromAuth(auth: unknown): HostedImageOwnership {
  const uploadedBy = tenantUserEmailFromAuth(auth)
  const base = uploadedBy ? { uploadedBy } : {}
  if (ownerScopedEmails(auth) === null) {
    return { ...base, visibility: HOSTED_IMAGE_VISIBILITY_SHARED }
  }
  return uploadedBy ? { ...base, ownerEmail: uploadedBy } : base
}
