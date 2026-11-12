import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('Beefree tenant permission', () => {
  it('hides the sidebar item until the flag is on', () => {
    const nav = readFileSync(resolve(root, 'app/constants/marketingSidebarNav.ts'), 'utf8')
    expect(nav).toContain('to: "/tenant/email-builder"')
    expect(nav).toContain('requiresTenantBeefree: true')

    const layout = readFileSync(resolve(root, 'app/layouts/default.vue'), 'utf8')
    expect(layout).toContain('allowTenantBeefreeBuilder')
    expect(layout).toContain('requiresTenantBeefree')
  })

  it('gates the page and the token route', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/email-builder/index.vue'), 'utf8')
    expect(page).toContain('allowTenantBeefreeBuilder')
    expect(page).toContain("navigateTo('/tenant/dashboard')")

    const token = readFileSync(
      resolve(root, 'server/api/v1/tenant/beefree/token.post.ts'),
      'utf8'
    )
    expect(token).toContain('requireTenantBeefreeBuilder')

    const patch = readFileSync(
      resolve(root, 'server/api/v1/admin/tenants/db/[dbName]/allow-tenant-beefree-builder.patch.ts'),
      'utf8'
    )
    expect(patch).toContain('allowTenantBeefreeBuilder')
    expect(patch).toContain('isAdminAuthContext')
  })
})
