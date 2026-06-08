import type { Connection } from 'mongoose'
import { brevoMessageIdVariants } from '@server/utils/brevo/brevoMessageIdVariants'

const ROUTING_COLLECTION = 'campaign_brevo_message_routing'

export type CampaignBrevoMessageRoutingRow = {
  brevoMessageId: string
  dbName: string
  campaignId: string
  recipientId?: string
  email?: string
  createdAt: Date
}

export async function registerCampaignBrevoMessageRouting(
  registryConn: Connection,
  rows: Array<Omit<CampaignBrevoMessageRoutingRow, 'createdAt'>>
): Promise<void> {
  if (!rows.length) return
  const now = new Date()
  const ops = rows.flatMap((row) => {
    const ids = brevoMessageIdVariants(row.brevoMessageId)
    return ids.map((brevoMessageId) => ({
      updateOne: {
        filter: { brevoMessageId },
        update: {
          $set: {
            brevoMessageId,
            dbName: row.dbName,
            campaignId: row.campaignId,
            ...(row.recipientId ? { recipientId: row.recipientId } : {}),
            ...(row.email ? { email: row.email.toLowerCase() } : {}),
            createdAt: now
          }
        },
        upsert: true
      }
    }))
  })
  await registryConn.collection(ROUTING_COLLECTION).bulkWrite(ops, { ordered: false })
}

export async function resolveCampaignBrevoRoutingByMessageId(
  registryConn: Connection,
  messageId: string
): Promise<CampaignBrevoMessageRoutingRow | null> {
  const variants = brevoMessageIdVariants(messageId)
  if (!variants.length) return null
  const doc = await registryConn.collection(ROUTING_COLLECTION).findOne({
    brevoMessageId: { $in: variants }
  })
  if (!doc || typeof doc !== 'object') return null
  const row = doc as Record<string, unknown>
  const dbName = typeof row.dbName === 'string' ? row.dbName.trim() : ''
  const campaignId = typeof row.campaignId === 'string' ? row.campaignId.trim() : ''
  const brevoMessageId = typeof row.brevoMessageId === 'string' ? row.brevoMessageId.trim() : ''
  if (!dbName || !campaignId || !brevoMessageId) return null
  return {
    brevoMessageId,
    dbName,
    campaignId,
    ...(typeof row.recipientId === 'string' ? { recipientId: row.recipientId } : {}),
    ...(typeof row.email === 'string' ? { email: row.email } : {}),
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date()
  }
}

function parseTagSegments(tagStr: string | undefined): string[] {
  if (!tagStr?.trim()) return []
  return tagStr.split(',').map((p) => p.trim()).filter(Boolean)
}

/** Fallback tenant/campaign resolution from Brevo tag string (`db:`, `campaign:`). */
export function resolveRoutingFromBrevoTags(tagStr: string | undefined): {
  dbName?: string
  campaignId?: string
} {
  const parts = parseTagSegments(tagStr)
  let dbName: string | undefined
  let campaignId: string | undefined
  for (const part of parts) {
    if (part.startsWith('db:')) dbName = part.slice(3).trim()
    if (part.startsWith('campaign:')) campaignId = part.slice(9).trim()
  }
  return { dbName, campaignId }
}
