import { tenantUserEmailFromAuth } from '@server/tenant/registry-auth'
import { ownerScopedEmails } from '@server/utils/emailTemplate/emailTemplateOwnership'
import type { HostedImageOwnership, HostedImageViewer } from '~~/shared/hostedImageAccess'

/**
 * Image library scope for this session.
 * Tenant-wide CRM sessions still only see their own private uploads (+ shared), not every
 * user’s library — contact `tenantWideContacts` must not open the media ACL.
 * Owner-scoped sessions keep manager downline via `contactOwnerScope`.
 */
export function hostedImageViewerFromAuth(auth: unknown): HostedImageViewer {
  const self = tenantUserEmailFromAuth(auth)
  const scope = ownerScopedEmails(auth)
  if (scope === null) {
    return { ownerEmails: self ? [self] : [] }
  }
  return { ownerEmails: self && !scope.includes(self) ? [...scope, self] : scope }
}

/**
 * GCS custom metadata for a new upload. Always private to the uploader when email is known.
 * Explicit `visibility=shared` is reserved for intentional tenant-wide sharing (not auto).
 */
export function hostedImageOwnershipFromAuth(auth: unknown): HostedImageOwnership {
  const uploadedBy = tenantUserEmailFromAuth(auth)
  if (!uploadedBy) return {}
  return { uploadedBy, ownerEmail: uploadedBy }
}
