<script setup lang="ts">
import type { EmailTemplateApprovalStatus } from '~~/shared/emailTemplateApproval'
import {
  EMAIL_TEMPLATE_APPROVAL_APPROVED,
  EMAIL_TEMPLATE_APPROVAL_PENDING,
  EMAIL_TEMPLATE_APPROVAL_REJECTED,
  resolveEmailTemplateApprovalStatus
} from '~~/shared/emailTemplateApproval'

const props = defineProps<{
  status?: string | null
}>()

const resolved = computed(() =>
  resolveEmailTemplateApprovalStatus(props.status ?? undefined)
)

const label = computed(() => {
  switch (resolved.value) {
    case EMAIL_TEMPLATE_APPROVAL_PENDING:
      return 'Pending approval'
    case EMAIL_TEMPLATE_APPROVAL_REJECTED:
      return 'Rejected'
    case EMAIL_TEMPLATE_APPROVAL_APPROVED:
    default:
      return 'Approved'
  }
})

const toneClass = computed(() => {
  switch (resolved.value as EmailTemplateApprovalStatus) {
    case EMAIL_TEMPLATE_APPROVAL_PENDING:
      return 'bg-amber-50 text-amber-800 ring-amber-200/80'
    case EMAIL_TEMPLATE_APPROVAL_REJECTED:
      return 'bg-red-50 text-red-800 ring-red-200/80'
    case EMAIL_TEMPLATE_APPROVAL_APPROVED:
    default:
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  }
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ring-1"
    :class="toneClass"
  >
    {{ label }}
  </span>
</template>
