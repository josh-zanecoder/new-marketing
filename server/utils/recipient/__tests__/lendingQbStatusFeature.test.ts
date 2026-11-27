/* eslint-disable import/first -- vi.mock must precede the imports it replaces */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const findOne = vi.fn()
const getRegistryConnection = vi.fn(async () => ({
  collection: () => ({ findOne })
}))

vi.mock('@server/lib/mongoose', () => ({
  getRegistryConnection: () => getRegistryConnection()
}))

import {
  invalidateLendingQbStatusFeatureCache,
  isLendingQbStatusEnabledForConnection,
  isLendingQbStatusEnabledForDb
} from '../lendingQbStatusFeature'

describe('isLendingQbStatusEnabledForDb', () => {
  beforeEach(() => {
    findOne.mockReset()
    getRegistryConnection.mockClear()
    invalidateLendingQbStatusFeatureCache()
  })

  it('is ON only for exact true on the tenant registry row', async () => {
    findOne.mockResolvedValueOnce({ allowTenantLendingQbStatus: true })
    expect(await isLendingQbStatusEnabledForDb('tenant_a')).toBe(true)
    findOne.mockResolvedValueOnce({ allowTenantLendingQbStatus: 'true' })
    expect(await isLendingQbStatusEnabledForDb('tenant_b')).toBe(false)
    findOne.mockResolvedValueOnce(null)
    expect(await isLendingQbStatusEnabledForDb('tenant_c')).toBe(false)
  })

  it('reads the registry once per tenant within the cache window', async () => {
    findOne.mockResolvedValue({ allowTenantLendingQbStatus: true })
    await isLendingQbStatusEnabledForDb('tenant_a')
    await isLendingQbStatusEnabledForDb('tenant_a')
    expect(findOne).toHaveBeenCalledTimes(1)
  })

  it('picks up a toggle change after the cache is invalidated', async () => {
    findOne.mockResolvedValueOnce({ allowTenantLendingQbStatus: false })
    expect(await isLendingQbStatusEnabledForDb('tenant_a')).toBe(false)
    invalidateLendingQbStatusFeatureCache('tenant_a')
    findOne.mockResolvedValueOnce({ allowTenantLendingQbStatus: true })
    expect(await isLendingQbStatusEnabledForDb('tenant_a')).toBe(true)
  })

  it('fails closed when the registry is unreachable and never caches the failure', async () => {
    findOne.mockRejectedValueOnce(new Error('down'))
    expect(await isLendingQbStatusEnabledForDb('tenant_a')).toBe(false)
    findOne.mockResolvedValueOnce({ allowTenantLendingQbStatus: true })
    expect(await isLendingQbStatusEnabledForDb('tenant_a')).toBe(true)
  })

  it('uses the connection name as the tenant db name', async () => {
    findOne.mockResolvedValueOnce({ allowTenantLendingQbStatus: true })
    expect(await isLendingQbStatusEnabledForConnection({ name: 'tenant_z' })).toBe(true)
    expect(findOne).toHaveBeenCalledWith(
      { dbName: 'tenant_z' },
      { projection: { allowTenantLendingQbStatus: 1 } }
    )
    expect(await isLendingQbStatusEnabledForDb('')).toBe(false)
  })
})
