import type { ComputedRef, Ref } from 'vue'
import { computed } from 'vue'
import {
  customMarketingBrowserAddressUrl,
  customMarketingInboxDateLabel,
  customMarketingSenderInitials
} from '~~/shared/customMarketingEditorOptions'

export type CustomMarketingEmailPreviewChromeBinders = {
  subjectDisplay: ComputedRef<string>
  fromNameDisplay: ComputedRef<string>
  fromEmailDisplay: ComputedRef<string>
  toDisplay: ComputedRef<string>
  senderInitials: ComputedRef<string>
  dateLabel: ComputedRef<string>
  browserAddressUrl: ComputedRef<string>
  browserTabLabel: ComputedRef<string>
}

export function useCustomMarketingEmailPreviewChrome(options: {
  subject: Ref<string> | ComputedRef<string> | string
  fromName: Ref<string> | ComputedRef<string> | string
  fromEmail: Ref<string> | ComputedRef<string> | string
  toEmail: Ref<string> | ComputedRef<string> | string
}): CustomMarketingEmailPreviewChromeBinders {
  function read(value: Ref<string> | ComputedRef<string> | string): string {
    if (typeof value === 'string') return value
    return value.value
  }

  const subjectDisplay = computed(() => read(options.subject).trim() || '(no subject)')
  const fromNameDisplay = computed(() => read(options.fromName).trim() || 'Sender')
  const fromEmailDisplay = computed(() => read(options.fromEmail).trim() || '')
  const toDisplay = computed(() => {
    const to = read(options.toEmail).trim()
    return to || 'Select a recipient list'
  })
  const senderInitials = computed(() =>
    customMarketingSenderInitials(fromNameDisplay.value, fromEmailDisplay.value)
  )
  const dateLabel = computed(() => customMarketingInboxDateLabel())
  const browserAddressUrl = computed(() => customMarketingBrowserAddressUrl(subjectDisplay.value))
  const browserTabLabel = computed(() => {
    const subject = subjectDisplay.value
    return subject === '(no subject)' ? 'Gmail' : `${subject} - Gmail`
  })

  return {
    subjectDisplay,
    fromNameDisplay,
    fromEmailDisplay,
    toDisplay,
    senderInitials,
    dateLabel,
    browserAddressUrl,
    browserTabLabel
  }
}
