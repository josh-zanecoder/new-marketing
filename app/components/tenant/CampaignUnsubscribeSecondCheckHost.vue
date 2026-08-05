<script setup lang="ts">
/** Thin host: pre-send unsubscribe approval modal + preview + success. */
const {
  open,
  pending,
  previewOpen,
  approving,
  successOpen,
  successSummary,
  title,
  message,
  approveText,
  declineText,
  previewText,
  approveHint,
  declineHint,
  openPreview,
  closePreview,
  decline,
  approve,
  closeSuccess
} = useCampaignUnsubscribeSecondCheckModal()
</script>

<template>
  <TenantCampaignUnsubscribeSecondCheckModal
    :open="open"
    :title="title"
    :message="message"
    :approve-text="approveText"
    :decline-text="declineText"
    :preview-text="previewText"
    :approve-hint="approveHint"
    :decline-hint="declineHint"
    :approving="approving"
    @preview="openPreview"
    @decline="decline"
    @approve="approve"
  />
  <TenantEmailTemplatePreviewModal
    :open="previewOpen"
    :name="pending?.campaignName || 'Campaign email'"
    :subject="pending?.subject"
    :html="pending?.previewHtml || ''"
    elevated
    @close="closePreview"
  />
  <ClientSendSuccessModal
    :open="successOpen"
    :campaign-name="successSummary.campaignName"
    :sent="successSummary.sent"
    :failed="successSummary.failed"
    :campaign-status="successSummary.campaignStatus"
    @close="closeSuccess"
  />
</template>
