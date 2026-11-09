import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('tenant Images library (Images flag path)', () => {
  it('sidebar Images item requires the Images flag', () => {
    const nav = readFileSync(resolve(root, 'app/constants/marketingSidebarNav.ts'), 'utf8')
    expect(nav).toContain("to: '/tenant/images'")
    expect(nav).toContain("label: 'Images'")
    expect(nav).toContain('requiresTenantImages: true')

    const layout = readFileSync(resolve(root, 'app/layouts/default.vue'), 'utf8')
    expect(layout).toContain('visibleSidebarNavItems')
    expect(layout).toContain('allowTenantImages')
    expect(layout).toContain('requiresTenantImages')
  })

  it('list + upload + delete APIs are Images-flag gated and use library folder on upload', () => {
    const getApi = readFileSync(
      resolve(root, 'server/api/v1/tenant/images/index.get.ts'),
      'utf8'
    )
    const postApi = readFileSync(
      resolve(root, 'server/api/v1/tenant/images/index.post.ts'),
      'utf8'
    )
    const deleteApi = readFileSync(
      resolve(root, 'server/api/v1/tenant/images/index.delete.ts'),
      'utf8'
    )
    expect(getApi).toContain('requireTenantImages')
    expect(postApi).toContain('requireTenantImages')
    expect(postApi).toContain('CUSTOM_MARKETING_GCS_LIBRARY_FOLDER')
    expect(deleteApi).toContain('requireTenantImages')
    expect(deleteApi).toContain('deleteCustomMarketingTenantImages')
  })

  it('Images page wires gallery + copy link + upload + select/bulk delete', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/images/index.vue'), 'utf8')
    expect(page).toContain('allowTenantImages')
    expect(page).toContain('fetchTenantHostedImages')
    expect(page).toContain('uploadTenantHostedImage')
    expect(page).toContain('deleteTenantHostedImages')
    expect(page).toContain('Copy link')
    expect(page).toContain('All files')
    expect(page).toContain('useClipboardCopy')
    expect(page).toContain('Select')
    expect(page).toContain('Delete selected')
    expect(page).toContain('selectMode')
    expect(page).toContain('openBulkDelete')
    expect(page).toContain('openPreview')
    expect(page).toContain('previewOpen')
    expect(page).toContain('Image preview')
  })

  it('clipboard helper has iframe-safe fallback', () => {
    const helper = readFileSync(resolve(root, 'app/composables/useClipboardCopy.ts'), 'utf8')
    expect(helper).toContain('execCommand')
    expect(helper).toContain('copyTextWithFallback')
  })
})
