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

const tenantWideUser2Auth = {
  ...user2Auth,
  tenantWideContacts: true,
  contactOwnerScope: []
}

const user1Image = hostedImageOwnershipFromAuth(user1Auth)
const tenantWideUpload = hostedImageOwnershipFromAuth(tenantWideAuth)
const sharedImage = {
  uploadedBy: 'admin@myfcltpo.com',
  visibility: HOSTED_IMAGE_VISIBILITY_SHARED
}
const legacyImage = {}

describe('hostedImageOwnershipFromAuth', () => {
  it('tags every upload as private to the uploader', () => {
    expect(user1Image).toEqual({
      uploadedBy: 'lthompson@myfcltpo.com',
      ownerEmail: 'lthompson@myfcltpo.com'
    })
  })

  it('does not auto-share uploads from tenant-wide CRM sessions', () => {
    expect(tenantWideUpload).toEqual({
      uploadedBy: 'admin@myfcltpo.com',
      ownerEmail: 'admin@myfcltpo.com'
    })
    expect(tenantWideUpload.visibility).toBeUndefined()
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

  it('hides private uploads between two tenant-wide CRM users', () => {
    const user1Private = hostedImageOwnershipFromAuth(tenantWideAuth)
    expect(canViewHostedImage(user1Private, hostedImageViewerFromAuth(tenantWideUser2Auth))).toBe(
      false
    )
    expect(canDeleteHostedImage(user1Private, hostedImageViewerFromAuth(tenantWideUser2Auth))).toBe(
      false
    )
    expect(canViewHostedImage(user1Private, hostedImageViewerFromAuth(tenantWideAuth))).toBe(true)
  })

  it('shows shared images to everyone but only the uploader scope may delete them', () => {
    expect(canViewHostedImage(sharedImage, hostedImageViewerFromAuth(user2Auth))).toBe(true)
    expect(canDeleteHostedImage(sharedImage, hostedImageViewerFromAuth(user2Auth))).toBe(false)
    expect(canDeleteHostedImage(sharedImage, hostedImageViewerFromAuth(tenantWideAuth))).toBe(true)
  })

  it('hides untagged legacy images from all sessions (including tenant-wide)', () => {
    expect(canViewHostedImage(legacyImage, hostedImageViewerFromAuth(user1Auth))).toBe(false)
    expect(canViewHostedImage(legacyImage, hostedImageViewerFromAuth(tenantWideAuth))).toBe(false)
  })

  it('scopes tenant-wide sessions to self only for the image library', () => {
    const viewer = hostedImageViewerFromAuth(tenantWideAuth)
    expect(viewer.ownerEmails).toEqual(['admin@myfcltpo.com'])
    expect(canViewHostedImage(user1Image, viewer)).toBe(false)
  })

  it('reads ownership from GCS custom metadata case-insensitively', () => {
    expect(
      hostedImageOwnershipFromGcsMetadata({
        OwnerEmail: 'a@b.com',
        visibility: 7,
        tenantName: 'Forge'
      })
    ).toEqual({ ownerEmail: 'a@b.com', visibility: undefined, uploadedBy: undefined })
    expect(
      hostedImageOwnershipFromGcsMetadata({ owneremail: 'c@d.com', UploadedBy: 'c@d.com' })
    ).toEqual({ ownerEmail: 'c@d.com', visibility: undefined, uploadedBy: 'c@d.com' })
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
