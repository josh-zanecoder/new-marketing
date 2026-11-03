import { formatPersonDisplayName } from './formatPersonDisplayName'
import {
  CONTACT_OWNER_SENDER_LABEL,
  isContactOwnerSenderPlaceholder,
  normalizeCampaignSenderDisplayName
} from './contactOwnerSender'

export type CampaignSenderDisplaySource = {
  senderMode?: string | null
  sender?: { name?: string | null; email?: string | null } | null
  replyTo?: { name?: string | null; email?: string | null } | null
  mergeUserSnapshot?: {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
  } | null
  sessionUser?: {
    firstName?: string | null
    lastName?: string | null
    name?: string | null
    email?: string | null
  } | null
}

/**
 * Overview / form display for campaign From — LO first+last when known.
 * Never prefers the legacy "Contact owner" placeholder when a real name or email exists.
 */
export function campaignSenderDisplayName(source: CampaignSenderDisplaySource): string {
  const selected = source.senderMode === 'selected'
  const senderEmail = String(source.sender?.email ?? '').trim()
  const storedSelected = normalizeCampaignSenderDisplayName(source.sender?.name, '')
  if (selected && storedSelected) return storedSelected

  const fromSnap = formatPersonDisplayName({
    firstName: source.mergeUserSnapshot?.firstName,
    lastName: source.mergeUserSnapshot?.lastName
  })
  if (fromSnap) return fromSnap

  const fromSession = formatPersonDisplayName({
    firstName: source.sessionUser?.firstName,
    lastName: source.sessionUser?.lastName,
    name: source.sessionUser?.name
  })
  if (fromSession) return fromSession

  const replyToName = normalizeCampaignSenderDisplayName(source.replyTo?.name, '')
  if (replyToName) return replyToName

  if (selected && senderEmail) return senderEmail

  const senderName = String(source.sender?.name ?? '').trim()
  if (senderName && !isContactOwnerSenderPlaceholder(senderName)) return senderName

  return (
    senderEmail ||
    String(source.replyTo?.email ?? '').trim() ||
    String(source.mergeUserSnapshot?.email ?? '').trim() ||
    String(source.sessionUser?.email ?? '').trim() ||
    CONTACT_OWNER_SENDER_LABEL
  )
}
