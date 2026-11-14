import { describe, expect, it } from 'vitest'
import {
  hostedImageOwnershipFromAuth,
  hostedImageViewerFromAuth
} from '@server/utils/hostedImage/hostedImageAccessFromAuth'
import {
  HOSTED_IMAGE_VISIBILITY_SHARED,
  canDeleteHostedImage,
  canViewHostedImage,
  hostedImageInUseMessage,
  hostedImageOwnershipFromGcsMetadata
} from '~~/shared/hostedImageAccess'

const user1Auth = {
  type: 'tenantApiKey',
  role: 'tenant',
  dbName: 'forge_capital_lending_db',
  tenantName: 'Forge',
  tenantUserEmail: 'LThompson@myfcltpo.com',
  contactOwnerScope: ['lthompson@myfcltpo.com']
}

const user2Auth = {
  ...user1Auth,
  tenantUserEmail: 'jreyes@myfcltpo.com',
  contactOwnerScope: ['jreyes@myfcltpo.com']
}

const managerAuth = {
  ...user1Auth,
  tenantUserEmail: 'manager@myfcltpo.com',
  contactOwnerScope: ['manager@myfcltpo.com', 'lthompson@myfcltpo.com']
}

const tenantWideAuth = {
  ...user1Auth,
  tenantUserEmail: 'admin@myfcltpo.com',
  tenantWideContacts: true,
  contactOwnerScope: []
}

const user1Image = hostedImageOwnershipFromAuth(user1Auth)
const sharedImage = hostedImageOwnershipFromAuth(tenantWideAuth)
const legacyImage = {}

describe('hostedImageOwnershipFromAuth', () => {
  it('tags owner-scoped uploads as private to the uploader', () => {
    expect(user1Image).toEqual({
      uploadedBy: 'lthompson@myfcltpo.com',
      ownerEmail: 'lthompson@myfcltpo.com'
    })
  })

  it('tags tenant-wide uploads as shared', () => {
    expect(sharedImage).toEqual({
      uploadedBy: 'admin@myfcltpo.com',
      visibility: HOSTED_IMAGE_VISIBILITY_SHARED
    })
  })
})

describe('image visibility', () => {
  it('hides one user’s uploads from another owner-scoped user', () => {
    expect(canViewHostedImage(user1Image, hostedImageViewerFromAuth(user2Auth))).toBe(false)
    expect(canDeleteHostedImage(user1Image, hostedImageViewerFromAuth(user2Auth))).toBe(false)
  })

  it('lets users see and delete their own uploads', () => {
    expect(canViewHostedImage(user1Image, hostedImageViewerFromAuth(user1Auth))).toBe(true)
    expect(canDeleteHostedImage(user1Image, hostedImageViewerFromAuth(user1Auth))).toBe(true)
  })

  it('keeps own uploads visible when the handoff scope omits self', () => {
    const viewer = hostedImageViewerFromAuth({ ...user1Auth, contactOwnerScope: [] })
    expect(canViewHostedImage(user1Image, viewer)).toBe(true)
    expect(canViewHostedImage(hostedImageOwnershipFromAuth(user2Auth), viewer)).toBe(false)
  })

  it('shows downline uploads to a manager whose scope includes them', () => {
    expect(canViewHostedImage(user1Image, hostedImageViewerFromAuth(managerAuth))).toBe(true)
  })

  it('shows shared images to everyone but only tenant-wide users may delete them', () => {
    expect(canViewHostedImage(sharedImage, hostedImageViewerFromAuth(user2Auth))).toBe(true)
    expect(canDeleteHostedImage(sharedImage, hostedImageViewerFromAuth(user2Auth))).toBe(false)
    expect(canDeleteHostedImage(sharedImage, hostedImageViewerFromAuth(tenantWideAuth))).toBe(true)
  })

  it('shows untagged legacy images only to tenant-wide users', () => {
    expect(canViewHostedImage(legacyImage, hostedImageViewerFromAuth(user1Auth))).toBe(false)
    expect(canViewHostedImage(legacyImage, hostedImageViewerFromAuth(tenantWideAuth))).toBe(true)
  })

  it('lets tenant-wide users see every image in the tenant', () => {
    const viewer = hostedImageViewerFromAuth(tenantWideAuth)
    expect(viewer.ownerEmails).toBeNull()
    expect(canViewHostedImage(user1Image, viewer)).toBe(true)
  })

  it('reads ownership from GCS custom metadata and ignores non-string values', () => {
    expect(
      hostedImageOwnershipFromGcsMetadata({ ownerEmail: 'a@b.com', visibility: 7, tenantName: 'Forge' })
    ).toEqual({ ownerEmail: 'a@b.com', visibility: undefined, uploadedBy: undefined })
    expect(hostedImageOwnershipFromGcsMetadata(undefined)).toEqual({})
  })
})

describe('hostedImageInUseMessage', () => {
  it('is empty when nothing uses the image', () => {
    expect(hostedImageInUseMessage({ visibleTemplateNames: [], otherCount: 0 })).toBe('')
  })

  it('names the templates the user can see', () => {
    expect(hostedImageInUseMessage({ visibleTemplateNames: ['Welcome', 'Promo'], otherCount: 0 }))
      .toContain('"Welcome" and "Promo"')
  })

  it('counts templates the user cannot see without naming them', () => {
    const message = hostedImageInUseMessage({ visibleTemplateNames: ['Welcome'], otherCount: 1 })
    expect(message).toContain('"Welcome" and 1 other template or campaign')
  })

  it('caps the list at three names', () => {
    const message = hostedImageInUseMessage({
      visibleTemplateNames: ['A', 'B', 'C', 'D', 'E'],
      otherCount: 0
    })
    expect(message).toContain('"A", "B", "C" and 2 other templates or campaigns')
  })
})
