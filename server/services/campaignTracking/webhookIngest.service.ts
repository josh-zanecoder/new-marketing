import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { CampaignEmailEventModel } from '@server/types/tenant/campaignEmailEvent.model'
import type { CampaignModel } from '@server/types/tenant/campaign.model'
import type { CampaignRecipientModel } from '@server/types/tenant/campaignRecipient.model'
import type { ParsedBrevoTransactionalWebhook } from '@server/utils/brevo/parseBrevoTransactionalWebhookPayload'
import { brevoMessageIdVariants } from '@server/utils/brevo/brevoMessageIdVariants'
import { getRegistryConnection } from '@server/lib/mongoose'
import { getTenantConnectionByDbName } from '@server/tenant/connection'
import {
  registerCampaignBrevoMessageRouting,
  resolveCampaignBrevoRoutingByMessageId,
  resolveRoutingFromBrevoTags
} from '@server/services/campaignBrevoMessageRouting.service'

function buildDedupeKey(parsed: ParsedBrevoTransactionalWebhook): string {
  const id = brevoMessageIdVariants(parsed.messageId)[0] || parsed.messageId
  return `${id}:${parsed.event}:${parsed.occurredAt.getTime()}`
}

/** Persist a transactional email webhook event and update recipient last-event fields. */
export async function applyCampaignEmailWebhook(
  parsed: ParsedBrevoTransactionalWebhook
): Promise<{ applied: boolean; dbName?: string; campaignId?: string; duplicate?: boolean }> {
  const registry = await getRegistryConnection()
  let routing = await resolveCampaignBrevoRoutingByMessageId(registry, parsed.messageId)

  if (!routing) {
    const fromTags = resolveRoutingFromBrevoTags(parsed.tag)
    if (fromTags.dbName && fromTags.campaignId) {
      routing = {
        brevoMessageId: brevoMessageIdVariants(parsed.messageId)[0] || parsed.messageId,
        dbName: fromTags.dbName,
        campaignId: fromTags.campaignId,
        ...(parsed.email ? { email: parsed.email } : {}),
        createdAt: new Date()
      }
      await registerCampaignBrevoMessageRouting(registry, [routing])
    }
  }

  if (!routing) {
    console.warn('[CampaignWebhook] no routing for message', {
      messageId: parsed.messageId,
      event: parsed.event
    })
    return { applied: false }
  }

  const tenantConn = await getTenantConnectionByDbName(routing.dbName)
  const { CampaignEmailEvent, CampaignRecipient } = getTenantClientModels(tenantConn)

  const dedupeKey = buildDedupeKey(parsed)
  const email = (parsed.email || routing.email || '').trim().toLowerCase()
  if (!email) {
    console.warn('[CampaignWebhook] missing email for event', {
      messageId: parsed.messageId,
      campaignId: routing.campaignId
    })
    return { applied: false, dbName: routing.dbName, campaignId: routing.campaignId }
  }

  try {
    await (CampaignEmailEvent as CampaignEmailEventModel).create({
      campaign: routing.campaignId,
      email,
      brevoMessageId: brevoMessageIdVariants(parsed.messageId)[0] || parsed.messageId,
      event: parsed.event,
      occurredAt: parsed.occurredAt,
      ...(parsed.reason ? { reason: parsed.reason } : {}),
      ...(parsed.link ? { link: parsed.link } : {}),
      ...(parsed.tag ? { tag: parsed.tag } : {}),
      dedupeKey
    })
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? (e as { code?: number }).code : undefined
    if (code === 11000) {
      return {
        applied: true,
        duplicate: true,
        dbName: routing.dbName,
        campaignId: routing.campaignId
      }
    }
    throw e
  }

  const messageVariants = brevoMessageIdVariants(parsed.messageId)
  await (CampaignRecipient as CampaignRecipientModel).updateMany(
    {
      campaign: routing.campaignId,
      brevoMessageId: { $in: messageVariants },
      ...(email ? { email } : {})
    },
    {
      $set: {
        brevoLastEvent: parsed.event,
        brevoLastEventAt: parsed.occurredAt
      }
    }
  )

  console.log('[CampaignWebhook] event stored', {
    dbName: routing.dbName,
    campaignId: routing.campaignId,
    messageId: parsed.messageId,
    event: parsed.event,
    email
  })

  return { applied: true, dbName: routing.dbName, campaignId: routing.campaignId }
}

/** @deprecated Use `applyCampaignEmailWebhook`. */
export const applyCampaignBrevoWebhook = applyCampaignEmailWebhook
