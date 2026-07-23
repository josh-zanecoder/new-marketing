import { createHash } from 'node:crypto'
import mongoose from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import { getTenantConnectionByDbName } from '@server/tenant/connection'

export type StoredUnsubscribeTokenResponse = {
  tokenHash: string
  contactId: string
  marketing: boolean
  respondedAt: Date
}

export function hashUnsubscribeToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex')
}

function isDuplicateKeyError(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000
  )
}

export async function findUnsubscribeTokenResponse(params: {
  dbName: string
  token: string
}): Promise<StoredUnsubscribeTokenResponse | null> {
  const tokenHash = hashUnsubscribeToken(params.token)
  const tenantConn = await getTenantConnectionByDbName(params.dbName)
  const { UnsubscribeTokenResponse } = getTenantClientModels(tenantConn)
  const row = await UnsubscribeTokenResponse.findOne({ tokenHash })
    .lean<{
      tokenHash: string
      contactId: mongoose.Types.ObjectId
      marketing: boolean
      respondedAt: Date
    } | null>()

  if (!row) return null
  return {
    tokenHash: row.tokenHash,
    contactId: String(row.contactId),
    marketing: row.marketing === true,
    respondedAt: row.respondedAt
  }
}

/**
 * Atomically claims a token for one preference response.
 * Returns the stored response (new or existing). `claimed` is true only for the first writer.
 */
export async function claimUnsubscribeTokenResponse(params: {
  dbName: string
  token: string
  contactId: string
  marketing: boolean
}): Promise<{ claimed: boolean; response: StoredUnsubscribeTokenResponse }> {
  const tokenHash = hashUnsubscribeToken(params.token)
  const tenantConn = await getTenantConnectionByDbName(params.dbName)
  const { UnsubscribeTokenResponse } = getTenantClientModels(tenantConn)
  const contactOid = new mongoose.Types.ObjectId(params.contactId)
  const respondedAt = new Date()

  try {
    await UnsubscribeTokenResponse.create({
      tokenHash,
      contactId: contactOid,
      marketing: params.marketing,
      respondedAt
    })
    return {
      claimed: true,
      response: {
        tokenHash,
        contactId: params.contactId,
        marketing: params.marketing,
        respondedAt
      }
    }
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err
    const existing = await findUnsubscribeTokenResponse({
      dbName: params.dbName,
      token: params.token
    })
    if (!existing) throw err
    return { claimed: false, response: existing }
  }
}

export async function releaseUnsubscribeTokenClaim(params: {
  dbName: string
  token: string
}): Promise<void> {
  const tokenHash = hashUnsubscribeToken(params.token)
  const tenantConn = await getTenantConnectionByDbName(params.dbName)
  const { UnsubscribeTokenResponse } = getTenantClientModels(tenantConn)
  await UnsubscribeTokenResponse.deleteOne({ tokenHash })
}

export function unsubscribePreferenceCopy(marketing: boolean): {
  title: string
  message: string
} {
  return {
    title: marketing ? 'Preferences saved' : 'You are unsubscribed',
    message: marketing
      ? 'You will continue to receive marketing emails from us at this address.'
      : 'You will no longer receive marketing emails from us at this address.'
  }
}
