import type { Connection } from 'mongoose'
import {
  DEFAULT_CAMPAIGN_SENDER_EMAIL,
  DEFAULT_CAMPAIGN_SENDER_NAME
} from '~~/shared/defaultCampaignSender'
import type { RegistryTenantDoc } from '@server/types/registry/registryTenant.types'
import { parseRegistryCampaignSenderFields } from '@server/utils/registry/tenantAdminRow'

export type ResolvedCampaignSenderDefaults = {
  name: string
  email: string
}

export function resolveCampaignSenderDefaultsFromDoc(
  doc: RegistryTenantDoc | null | undefined
): ResolvedCampaignSenderDefaults {
  if (!doc) {
    return {
      name: DEFAULT_CAMPAIGN_SENDER_NAME,
      email: DEFAULT_CAMPAIGN_SENDER_EMAIL
    }
  }
  const { defaultCampaignSenderEmail, defaultCampaignSenderName } =
    parseRegistryCampaignSenderFields(doc)
  return {
    name: defaultCampaignSenderName ?? DEFAULT_CAMPAIGN_SENDER_NAME,
    email: defaultCampaignSenderEmail ?? DEFAULT_CAMPAIGN_SENDER_EMAIL
  }
}

export async function resolveDefaultCampaignSenderForDbName(
  registryConn: Connection,
  dbName: string
): Promise<ResolvedCampaignSenderDefaults> {
  const key = dbName.trim()
  if (!key) {
    return resolveCampaignSenderDefaultsFromDoc(null)
  }
  const doc = (await registryConn
    .collection('clients')
    .findOne({ dbName: key })) as RegistryTenantDoc | null
  return resolveCampaignSenderDefaultsFromDoc(doc)
}
