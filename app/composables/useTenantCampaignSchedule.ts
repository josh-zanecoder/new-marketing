import type { Campaign } from '~/types/campaign'
import { toDatetimeLocalValue } from '~/utils/campaignDisplay'
import { fetchErrorMessage } from '~/utils/fetchErrorMessage'
import {
  canResumeSchedule,
  canScheduleAgainCampaign,
  canScheduleDraft
} from '~/utils/campaignSendRules'
import {
  scheduleModalDescription,
  scheduleModalTitle,
  type CampaignScheduleMode
} from '~/utils/campaignScheduleCopy'

type UseTenantCampaignScheduleOptions = {
  /** Campaign for detail/edit pages; list pages pass per-row campaign via `openFor`. */
  getCampaign?: () => Campaign | null
  onScheduled: () => void | Promise<void>
}

function canScheduleWithMode(c: Campaign, mode: CampaignScheduleMode): boolean {
  if (mode === 'new') return canScheduleDraft(c)
  if (mode === 'resume') return canResumeSchedule(c)
  return canScheduleAgainCampaign(c)
}

export function useTenantCampaignSchedule(options: UseTenantCampaignScheduleOptions) {
  const marketingApi = useTenantMarketingApi()
  const listCampaign = ref<Campaign | null>(null)
  const open = ref(false)
  const mode = ref<CampaignScheduleMode>('new')
  const scheduleLocal = ref('')
  const scheduleError = ref('')
  const scheduleBusy = ref(false)

  const title = computed(() => scheduleModalTitle(mode.value))
  const description = computed(() => scheduleModalDescription(mode.value))
  const displayCampaign = computed(() => listCampaign.value ?? options.getCampaign?.() ?? null)

  function resetDatetimeField() {
    scheduleLocal.value = toDatetimeLocalValue(new Date(Date.now() + 65 * 60 * 1000))
  }

  /** Open schedule modal for a list-row campaign. */
  function openFor(c: Campaign, scheduleMode: CampaignScheduleMode = 'new') {
    listCampaign.value = c
    mode.value = scheduleMode
    scheduleError.value = ''
    resetDatetimeField()
    open.value = true
  }

  /** Open schedule modal using `getCampaign` (detail page). */
  function openWithMode(scheduleMode: CampaignScheduleMode = 'new') {
    listCampaign.value = null
    mode.value = scheduleMode
    scheduleError.value = ''
    resetDatetimeField()
    open.value = true
  }

  function close() {
    open.value = false
    listCampaign.value = null
    scheduleError.value = ''
  }

  async function confirm() {
    const c = displayCampaign.value
    const currentMode = mode.value
    if (!c || !canScheduleWithMode(c, currentMode)) return

    scheduleError.value = ''
    const parsed = new Date(scheduleLocal.value)
    if (Number.isNaN(parsed.getTime())) {
      scheduleError.value = 'Pick a valid date and time.'
      return
    }

    scheduleBusy.value = true
    try {
      await marketingApi.scheduleCampaignSend(c.id, parsed.toISOString(), currentMode)
      close()
      await options.onScheduled()
    } catch (e: unknown) {
      scheduleError.value = fetchErrorMessage(e, 'Could not schedule send.')
    } finally {
      scheduleBusy.value = false
    }
  }

  async function unschedule(c: Campaign) {
    if (c.status !== 'Scheduled') return
    scheduleBusy.value = true
    try {
      await marketingApi.unscheduleCampaignSend(c.id)
      await options.onScheduled()
    } finally {
      scheduleBusy.value = false
    }
  }

  return {
    open,
    mode,
    scheduleLocal,
    scheduleError,
    scheduleBusy,
    title,
    description,
    displayCampaign,
    openFor,
    openWithMode,
    close,
    confirm,
    unschedule
  }
}
