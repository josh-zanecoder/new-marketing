import { describe, expect, it } from 'vitest'
import { MARKETING_FLYERS_ADD_PERMISSION } from '~~/shared/constants/marketingFlyersPermissions'
import { requireMarketingFlyersPermission } from '../requireMarketingFlyersPermission'

function makeEvent(auth: unknown) {
  return { context: { auth } } as Parameters<typeof requireMarketingFlyersPermission>[0]
}

describe('requireMarketingFlyersPermission', () => {
  it('allows firebase sessions without a CRM permission snapshot', () => {
    expect(() =>
      requireMarketingFlyersPermission(
        makeEvent({ uid: 'u1', role: 'tenant' }),
        MARKETING_FLYERS_ADD_PERMISSION
      )
    ).not.toThrow()
  })

  it('allows apiKey sessions that omit permissions', () => {
    expect(() =>
      requireMarketingFlyersPermission(
        makeEvent({ type: 'tenantApiKey', role: 'tenant', tenantName: 'Acme', dbName: 'acme' }),
        MARKETING_FLYERS_ADD_PERMISSION
      )
    ).not.toThrow()
  })

  it('rejects apiKey sessions missing the required permission', () => {
    expect(() =>
      requireMarketingFlyersPermission(
        makeEvent({
          type: 'tenantApiKey',
          role: 'tenant',
          tenantName: 'Acme',
          dbName: 'acme',
          permissions: ['marketing:flyers:read']
        }),
        MARKETING_FLYERS_ADD_PERMISSION
      )
    ).toThrow(/Missing permission/)
  })

  it('allows apiKey sessions that include the required permission', () => {
    expect(() =>
      requireMarketingFlyersPermission(
        makeEvent({
          type: 'tenantApiKey',
          role: 'tenant',
          tenantName: 'Acme',
          dbName: 'acme',
          permissions: [MARKETING_FLYERS_ADD_PERMISSION]
        }),
        MARKETING_FLYERS_ADD_PERMISSION
      )
    ).not.toThrow()
  })
})
