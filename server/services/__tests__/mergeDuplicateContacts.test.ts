/* eslint-disable import/first -- imports must follow vi.mock() */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { isEnabled, getConn, getModels, mergeContacts, ensureIndex, syncMembership } = vi.hoisted(() => ({
  isEnabled: vi.fn(),
  getConn: vi.fn(),
  getModels: vi.fn(),
  mergeContacts: vi.fn(),
  ensureIndex: vi.fn(),
  syncMembership: vi.fn(async () => undefined)
}))

vi.mock('../../utils/recipient/lendingQbStatusFeature', () => ({
  isLendingQbStatusEnabledForDb: isEnabled
}))
vi.mock('../../tenant/connection', () => ({ getTenantConnectionByDbName: getConn }))
vi.mock('../../models/tenant/tenantClientModels', () => ({ getTenantClientModels: getModels }))
vi.mock('../../lib/mongoose', () => ({ getRegistryConnection: vi.fn() }))
vi.mock('../../utils/contact/mergeDuplicateContactsByEmail', () => ({
  mergeDuplicateContactsByEmail: mergeContacts
}))
vi.mock('../../utils/contact/uniqueActiveContactEmailIndex', () => ({
  ensureUniqueActiveContactEmailIndex: ensureIndex
}))
vi.mock('../../utils/recipient/syncContactRecipientListMembership', () => ({
  syncContactRecipientListMembership: syncMembership
}))

import { sweepDuplicateContactsForDb } from '../mergeDuplicateContacts'

describe('sweepDuplicateContactsForDb', () => {
  beforeEach(() => {
    isEnabled.mockReset()
    getConn.mockReset()
    getModels.mockReset()
    mergeContacts.mockReset()
    ensureIndex.mockReset()
    getConn.mockResolvedValue({ name: 'tenant_db' })
    getModels.mockReturnValue({
      Contact: { estimatedDocumentCount: async () => 3, collection: {} }
    })
    mergeContacts.mockResolvedValue({ groups: 0, keptIds: [], retiredIds: [], hasMore: false })
    ensureIndex.mockResolvedValue(true)
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('does nothing for a tenant whose LendingQB permission is OFF', async () => {
    isEnabled.mockResolvedValue(false)

    const result = await sweepDuplicateContactsForDb('off_tenant')

    expect(result).toEqual({ merged: 0, hasMore: false })
    expect(getConn).not.toHaveBeenCalled()
    expect(mergeContacts).not.toHaveBeenCalled()
    expect(ensureIndex).not.toHaveBeenCalled()
  })

  it('merges duplicates and locks the tenant when the LendingQB permission is ON', async () => {
    isEnabled.mockResolvedValue(true)
    mergeContacts.mockResolvedValue({
      groups: 1,
      keptIds: ['507f1f77bcf86cd799439011'],
      retiredIds: ['507f1f77bcf86cd799439012'],
      hasMore: false
    })

    const result = await sweepDuplicateContactsForDb('on_tenant')

    expect(result).toEqual({ merged: 1, hasMore: false })
    expect(mergeContacts).toHaveBeenCalledTimes(1)
    expect(syncMembership).toHaveBeenCalledTimes(2)
    expect(ensureIndex).toHaveBeenCalledTimes(1)
  })

  it('does not lock the tenant while duplicates remain, and asks for another pass', async () => {
    isEnabled.mockResolvedValue(true)
    mergeContacts.mockResolvedValue({ groups: 0, keptIds: [], retiredIds: [], hasMore: true })

    const result = await sweepDuplicateContactsForDb('busy_tenant')

    expect(result.hasMore).toBe(true)
    expect(ensureIndex).not.toHaveBeenCalled()
  })

  it('skips tenants that are already locked by the unique index', async () => {
    isEnabled.mockResolvedValue(true)
    await sweepDuplicateContactsForDb('locked_tenant')
    expect(ensureIndex).toHaveBeenCalledTimes(1)

    mergeContacts.mockClear()
    await sweepDuplicateContactsForDb('locked_tenant')
    expect(mergeContacts).not.toHaveBeenCalled()
  })
})
