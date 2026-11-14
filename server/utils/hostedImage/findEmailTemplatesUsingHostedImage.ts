import type { Connection } from 'mongoose'
import { getTenantClientModels } from '@server/models/tenant/tenantClientModels'
import type { EmailTemplateModel } from '@server/types/tenant/emailTemplate.model'
import { mergeEmailTemplateVisibilityFilter } from '@server/utils/emailTemplate/emailTemplateOwnership'

export type HostedImageTemplateUsage = {
  /** Active templates using the image that this session can see. */
  visibleTemplateNames: string[]
  /** Other references: templates this session cannot see, or deleted templates still behind a campaign. */
  otherCount: number
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Templates whose HTML still points at a hosted image. Deleted templates count only while a
 * campaign references them, since sent emails keep loading the image from its URL.
 */
export async function findEmailTemplatesUsingHostedImage(
  conn: Connection,
  objectPath: string,
  auth: unknown
): Promise<HostedImageTemplateUsage> {
  const fileName = objectPath.split('/').pop()?.trim() ?? ''
  if (!fileName) return { visibleTemplateNames: [], otherCount: 0 }

  const { EmailTemplate, Campaign } = getTenantClientModels(conn)
  const model = EmailTemplate as EmailTemplateModel
  const matches = await model
    .find({ htmlTemplate: new RegExp(escapeRegex(fileName)) })
    .select('_id deletedAt')
    .lean<Array<{ _id: unknown; deletedAt?: Date | null }>>()
  if (!matches.length) return { visibleTemplateNames: [], otherCount: 0 }

  const deletedIds = matches.filter((t) => t.deletedAt).map((t) => t._id)
  const campaignTemplateIds = new Set<string>()
  if (deletedIds.length) {
    const ids = await Campaign.distinct('emailTemplate', { emailTemplate: { $in: deletedIds } })
    for (const id of ids) campaignTemplateIds.add(String(id))
  }

  const inUse = matches.filter((t) => !t.deletedAt || campaignTemplateIds.has(String(t._id)))
  if (!inUse.length) return { visibleTemplateNames: [], otherCount: 0 }

  const visible = await model
    .find(mergeEmailTemplateVisibilityFilter(
      { _id: { $in: inUse.map((t) => t._id) }, deletedAt: null },
      auth
    ))
    .select('name')
    .lean<Array<{ name?: string }>>()

  const visibleTemplateNames = visible.map((t) => String(t.name ?? '').trim() || 'Untitled template')
  return { visibleTemplateNames, otherCount: inUse.length - visibleTemplateNames.length }
}
