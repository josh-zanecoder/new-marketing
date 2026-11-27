/* eslint-disable import/first -- imports must follow vi.mock() */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { isEnabled, collapseNew, collapseLegacy } = vi.hoisted(() => ({
  isEnabled: vi.fn(),
  collapseNew: vi.fn(),
  collapseLegacy: vi.fn()
}))

vi.mock('@server/utils/recipient/lendingQbStatusFeature', () => ({
  isLendingQbStatusEnabledForConnection: isEnabled
}))
vi.mock('./collapseInboundContactsByEmail', () => ({
  collapseInboundContactsByEmail: collapseNew
}))
vi.mock('./collapseInboundContactsByEmailLegacy', () => ({
  collapseInboundContactsByEmailLegacy: collapseLegacy
}))

import { collapseInboundContactsForTenant } from './collapseInboundContactsForTenant'

describe('collapseInboundContactsForTenant', () => {
  const tenantConn = { name: 'tenant_db' } as never
  const Contact = {} as never
  const rows = [{ email: 'a@x.com', externalId: 'b-1', setDoc: {} }]

  beforeEach(() => {
    isEnabled.mockReset()
    collapseNew.mockReset()
    collapseLegacy.mockReset()
    collapseNew.mockResolvedValue({ keptIds: ['new'], retiredIds: [] })
    collapseLegacy.mockResolvedValue({ keptIds: ['legacy'], retiredIds: [] })
  })

  it('uses the stable oldest-owner collapse when the LendingQB permission is ON', async () => {
    isEnabled.mockResolvedValue(true)
    const result = await collapseInboundContactsForTenant({
      tenantConn,
      Contact,
      source: 'crm-kafka',
      rows
    })
    expect(result.keptIds).toEqual(['new'])
    expect(collapseLegacy).not.toHaveBeenCalled()
    expect(collapseNew).toHaveBeenCalledWith({ Contact, source: 'crm-kafka', rows })
  })

  it('keeps the original collapse when the LendingQB permission is OFF', async () => {
    isEnabled.mockResolvedValue(false)
    const now = new Date('2026-11-28T00:00:00.000Z')
    const result = await collapseInboundContactsForTenant({
      tenantConn,
      Contact,
      source: 'crm-kafka',
      rows,
      now
    })
    expect(result.keptIds).toEqual(['legacy'])
    expect(collapseNew).not.toHaveBeenCalled()
    expect(collapseLegacy).toHaveBeenCalledWith({ Contact, source: 'crm-kafka', rows, now })
  })
})
