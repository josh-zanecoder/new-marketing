export type CampaignZcMailTagInput = {
  dbName?: string | null
  tenantId?: string | null
  campaignId?: string | null
  user?: string | null
  source?: string
}

/** Object tags for zcMail send; webhook parser maps these back to `db:` / `tenant:` strings. */
export function buildCampaignZcMailTags(input: CampaignZcMailTagInput): Record<string, string> {
  const tags: Record<string, string> = {
    source: input.source?.trim() || 'new-marketing-campaign'
  }
  const db = input.dbName?.trim()
  if (db) tags.db = db
  const tenant = input.tenantId?.trim()
  if (tenant) tags.tenant = tenant
  const campaign = input.campaignId?.trim()
  if (campaign) tags.campaign = campaign
  const user = input.user?.trim()
  if (user) tags.user = user
  return tags
}

export function zcMailObjectTagsToBrevoTagList(tags: Record<string, string>): string[] {
  const out: string[] = []
  const db = tags.db?.trim()
  if (db) out.push(`db:${db}`)
  const tenant = tags.tenant?.trim()
  if (tenant) out.push(`tenant:${tenant}`)
  const campaign = tags.campaign?.trim()
  if (campaign) out.push(`campaign:${campaign}`)
  const user = tags.user?.trim()
  if (user) out.push(`user:${user}`)
  const source = tags.source?.trim()
  if (source) out.push(`source:${source}`)
  return out
}

export const ZC_MAIL_CAMPAIGN_TEST_SOURCE = 'new-marketing-test'

export function zcMailTagsAreCampaignTestSend(
  tags: Record<string, string> | null | undefined
): boolean {
  const source = (tags?.source || '').trim().toLowerCase()
  return source === ZC_MAIL_CAMPAIGN_TEST_SOURCE || source.includes('test-email')
}

/** Mongo `tag` values written for campaign "Send test email" (not the campaign send). */
export const CAMPAIGN_TEST_EMAIL_TAG_RE =
  /(source:new-marketing-test|(^|[|,])test-email([|,]|$))/i

export function mongoExcludeCampaignTestEmailTag(): { tag: { $not: RegExp } } {
  return { tag: { $not: CAMPAIGN_TEST_EMAIL_TAG_RE } }
}

/** Search terms for zcMail archive `q` when scoping to a marketing campaign. */
export function zcMailArchiveCampaignSearchTerms(campaignId: string): string[] {
  const id = campaignId.trim()
  if (!id) return []
  return [...new Set([id, `campaign:${id}`])]
}
