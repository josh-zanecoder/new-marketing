import { ZC_MAIL_MESSAGE_ROUTING_COLLECTION } from '@server/constants/zcMailWebhook'
import { getRegistryConnection } from '@server/lib/mongoose'

export type EmailMessageRoutingEntry = {
  messageId: string
  dbName: string
  campaignId?: string | null
  /** CRM operator email from send tags (`user:`). Restored when archive tags are empty. */
  userEmail?: string | null
}

function messageIdVariants(messageId: string): string[] {
  const id = messageId.trim()
  if (!id) return []
  return [...new Set([id, id.replace(/^<|>$/g, ''), `<${id.replace(/^<|>$/g, '')}>`])]
}

function normalizeRoutingUserEmail(value: string | null | undefined): string {
  const email = String(value || '')
    .trim()
    .toLowerCase()
  return email.includes('@') ? email : ''
}

export async function registerEmailMessageRouting(
  entries: EmailMessageRoutingEntry[]
): Promise<void> {
  const rows = entries
    .map((e) => ({
      messageId: String(e.messageId || '').trim(),
      dbName: String(e.dbName || '').trim(),
      campaignId: typeof e.campaignId === 'string' ? e.campaignId.trim() : '',
      userEmail: normalizeRoutingUserEmail(e.userEmail)
    }))
    .filter((e) => e.messageId && e.dbName)
  if (!rows.length) return

  const registry = await getRegistryConnection()
  const now = new Date()
  await registry.collection(ZC_MAIL_MESSAGE_ROUTING_COLLECTION).bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { messageId: row.messageId },
        update: {
          $set: {
            messageId: row.messageId,
            dbName: row.dbName,
            updatedAt: now,
            ...(row.campaignId ? { campaignId: row.campaignId } : {}),
            ...(row.userEmail ? { userEmail: row.userEmail } : {})
          },
          $setOnInsert: { createdAt: now }
        },
        upsert: true
      }
    })),
    { ordered: false }
  )
}

export async function findDbNameByMessageId(messageId: string): Promise<string | null> {
  const variants = messageIdVariants(messageId)
  if (!variants.length) return null
  const registry = await getRegistryConnection()
  const doc = await registry.collection(ZC_MAIL_MESSAGE_ROUTING_COLLECTION).findOne({
    messageId: { $in: variants }
  })
  const dbName = typeof doc?.dbName === 'string' ? doc.dbName.trim() : ''
  return dbName || null
}

export type EmailMessageRoutingHit = {
  dbName: string
  campaignId: string
  userEmail: string
}

/**
 * Lookup routing rows for many archive/SES ids. Keys in the map are the raw ids passed in
 * plus stripped/angle-bracket variants pointing at the same hit.
 */
export async function findEmailMessageRoutingMap(
  messageIds: string[]
): Promise<Map<string, EmailMessageRoutingHit>> {
  const wanted = [...new Set(messageIds.map((id) => String(id || '').trim()).filter(Boolean))]
  const out = new Map<string, EmailMessageRoutingHit>()
  if (!wanted.length) return out

  const variants = [...new Set(wanted.flatMap((id) => messageIdVariants(id)))]
  const registry = await getRegistryConnection()
  const docs = await registry
    .collection(ZC_MAIL_MESSAGE_ROUTING_COLLECTION)
    .find({ messageId: { $in: variants } })
    .project({ messageId: 1, dbName: 1, campaignId: 1, userEmail: 1 })
    .toArray()

  const byStoredId = new Map<string, EmailMessageRoutingHit>()
  for (const doc of docs) {
    const storedId = typeof doc.messageId === 'string' ? doc.messageId.trim() : ''
    const dbName = typeof doc.dbName === 'string' ? doc.dbName.trim() : ''
    if (!storedId || !dbName) continue
    const campaignId = typeof doc.campaignId === 'string' ? doc.campaignId.trim() : ''
    const userEmail = normalizeRoutingUserEmail(
      typeof doc.userEmail === 'string' ? doc.userEmail : ''
    )
    const hit = { dbName, campaignId, userEmail }
    for (const variant of messageIdVariants(storedId)) {
      byStoredId.set(variant, hit)
    }
  }

  for (const id of wanted) {
    const hit =
      byStoredId.get(id) ||
      byStoredId.get(id.replace(/^<|>$/g, '')) ||
      byStoredId.get(`<${id.replace(/^<|>$/g, '')}>`)
    if (hit) out.set(id, hit)
  }
  return out
}
