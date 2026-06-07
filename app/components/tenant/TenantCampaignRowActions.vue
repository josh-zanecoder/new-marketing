<script setup lang="ts">
import type { Campaign } from '~/types/campaign'
import {
  canDuplicateCampaign,
  canEditCampaign,
  canOpenSendAgainModal,
  sendAgainTooltip
} from '~/utils/campaignActionRules'
import {
  canDiscardPaused,
  canResumeSchedule,
  canResumeSend,
  canResumeUnsentOnly,
  canScheduleAgainCampaign,
  canScheduleDraft,
  canSendDraft
} from '~/utils/campaignSendRules'
import type { CampaignScheduleMode } from '~/utils/campaignScheduleCopy'

defineProps<{
  campaign: Campaign
  sendingCampaignId: string | null
  scheduleBusy: boolean
  discardConfirmLoading: boolean
}>()

defineEmits<{
  send: [campaign: Campaign]
  'resume-send': [campaign: Campaign]
  'resume-unsent': [campaign: Campaign]
  schedule: [campaign: Campaign, mode: CampaignScheduleMode]
  'send-again': [campaign: Campaign]
  discard: [campaign: Campaign]
  'stop-send': [campaign: Campaign]
  unschedule: [campaign: Campaign]
  duplicate: [campaign: Campaign]
  delete: [campaign: Campaign]
}>()
</script>

<template>
  <div class="flex shrink-0 items-center justify-end gap-0.5">
    <ClientIconTooltipButton
      v-if="canSendDraft(campaign)"
      label="Send campaign"
      button-class="hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-500/30"
      :disabled="!!sendingCampaignId || scheduleBusy"
      @click.stop="$emit('send', campaign)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      v-if="canResumeSend(campaign)"
      label="Resume send"
      button-class="hover:bg-sky-50 hover:text-sky-700 focus-visible:ring-sky-500/25"
      :disabled="!!sendingCampaignId || scheduleBusy"
      @click.stop="$emit('resume-send', campaign)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      v-if="canResumeUnsentOnly(campaign)"
      label="Resume unsent only"
      button-class="hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-slate-500/25"
      :disabled="!!sendingCampaignId || scheduleBusy"
      @click.stop="$emit('resume-unsent', campaign)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      v-if="canResumeSchedule(campaign)"
      label="Resume schedule"
      button-class="hover:bg-violet-50 hover:text-violet-700 focus-visible:ring-violet-500/25"
      :disabled="!!sendingCampaignId || scheduleBusy"
      @click.stop="$emit('schedule', campaign, 'resume')"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      v-if="canOpenSendAgainModal(campaign)"
      :label="sendAgainTooltip(campaign)"
      button-class="hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-500/30"
      :disabled="!!sendingCampaignId || scheduleBusy"
      @click.stop="$emit('send-again', campaign)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      v-if="canScheduleDraft(campaign)"
      label="Schedule send"
      button-class="hover:bg-sky-50 hover:text-sky-700 focus-visible:ring-sky-500/25"
      :disabled="!!sendingCampaignId || scheduleBusy"
      @click.stop="$emit('schedule', campaign, 'new')"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      v-if="canScheduleAgainCampaign(campaign)"
      label="Schedule again"
      button-class="hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-500/30"
      :disabled="!!sendingCampaignId || scheduleBusy"
      @click.stop="$emit('schedule', campaign, 'resend_all')"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      v-if="canDiscardPaused(campaign)"
      label="Cancel permanently"
      button-class="hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-rose-500/25"
      :disabled="discardConfirmLoading"
      @click.stop="$emit('discard', campaign)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      v-if="campaign.status === 'Sending'"
      label="Stop send"
      button-class="hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-slate-500/25"
      :disabled="!!sendingCampaignId && sendingCampaignId !== campaign.id"
      @click.stop="$emit('stop-send', campaign)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      v-if="campaign.status === 'Scheduled'"
      label="Cancel schedule"
      button-class="text-amber-600 hover:bg-amber-50 hover:text-amber-800 focus-visible:ring-amber-500/25"
      :disabled="scheduleBusy"
      @click.stop="$emit('unschedule', campaign)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipLink
      v-if="canEditCampaign(campaign)"
      :to="`/tenant/campaigns/edit/${campaign.id}`"
      label="Edit campaign"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </ClientIconTooltipLink>
    <ClientIconTooltipButton
      v-if="canDuplicateCampaign(campaign)"
      label="Duplicate campaign"
      button-class="hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-indigo-500/25"
      @click.stop="$emit('duplicate', campaign)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    </ClientIconTooltipButton>
    <ClientIconTooltipButton
      label="Delete campaign"
      button-class="hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-500/30"
      @click.stop="$emit('delete', campaign)"
    >
      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </ClientIconTooltipButton>
  </div>
</template>
