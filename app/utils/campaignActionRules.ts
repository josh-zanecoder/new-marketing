import type { Campaign, CampaignSendCancelReport, SendStatus } from '~/types/campaign'
import { canSendAgainCampaign, canSendAgainWhilePaused } from '~/utils/campaignSendRules'

export function canEditCampaign(c: Campaign): boolean {
  return c.status === 'Draft' || c.status === 'Failed' || c.status === 'Scheduled'
}

export function canDuplicateCampaign(c: Campaign): boolean {
  return c.status === 'Sent' || c.status === 'Failed'
}

export function canOpenSendAgainModal(c: Campaign): boolean {
  return canSendAgainCampaign(c) || canSendAgainWhilePaused(c)
}

export function sendAgainTooltip(c: Campaign): string {
  return c.status === 'Paused' ? 'Send to all again' : 'Send again to all recipients'
}

export function sendAgainModalTitle(c: Campaign | null | undefined): string {
  if (!c) return 'Send again to all recipients?'
  return c.status === 'Paused' ? 'Send to all again?' : 'Send again to all recipients?'
}

export function sendAgainModalMessage(c: Campaign | null | undefined): string {
  if (!c) return ''
  const name = c.name || 'Untitled'
  return `Send "${name}" to all recipients again? People who already received this campaign may get duplicate emails.`
}

export function duplicateModalMessage(c: Campaign | null | undefined): string {
  if (!c) return ''
  return `Create a copy of "${c.name || 'Untitled'}"? The duplicate will be created as a draft.`
}

export function discardPausedModalMessage(c: Campaign | null | undefined): string {
  if (!c) return ''
  return `Cancel "${c.name || 'Untitled'}" permanently? It will move to Cancelled and you can no longer resume from where you left off.`
}

export function isTerminalSendStop(
  sendCancelReport: CampaignSendCancelReport | null | undefined,
  sendStatus: SendStatus | null | undefined
): boolean {
  return (
    !!sendCancelReport ||
    (!!sendStatus?.done &&
      ['Paused', 'Cancelled', 'Sent', 'Failed'].includes(sendStatus.campaignStatus))
  )
}
