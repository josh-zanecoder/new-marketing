/**
 * Shared pending template-approval count for the marketing sidebar badge.
 * Gated by LO recipient-lists flag + OM/Marketing approver access.
 */
export function usePendingEmailTemplateApprovalsCount() {
  const marketingApi = useTenantMarketingApi()
  const {
    allowTenantLoRecipientLists,
    canSelectAnyLoanOfficer,
    loadDefaultCampaignSender,
    loaded: loFlagLoaded
  } = useDefaultCampaignSender()

  const pendingCount = useState('marketing-pending-email-template-approvals-count', () => 0)
  const loading = useState('marketing-pending-email-template-approvals-loading', () => false)
  const lastFetchedAt = useState<number | null>(
    'marketing-pending-email-template-approvals-fetched-at',
    () => null
  )

  const canFetch = computed(
    () =>
      loFlagLoaded.value &&
      allowTenantLoRecipientLists.value === true &&
      canSelectAnyLoanOfficer.value === true
  )

  const showBadge = computed(() => canFetch.value && pendingCount.value > 0)

  const badgeLabel = computed(() => {
    const n = pendingCount.value
    if (n <= 0) return ''
    return n > 99 ? '99+' : String(n)
  })

  function setCount(n: number) {
    pendingCount.value = Math.max(0, Math.floor(n))
  }

  function syncFromTemplatesLength(length: number) {
    setCount(length)
    lastFetchedAt.value = Date.now()
  }

  async function refreshPendingCount(options?: { force?: boolean }) {
    if (!loFlagLoaded.value) {
      await loadDefaultCampaignSender()
    }
    if (!canFetch.value) {
      setCount(0)
      lastFetchedAt.value = Date.now()
      return 0
    }

    const force = options?.force === true
    const staleMs = 30_000
    if (
      !force &&
      lastFetchedAt.value != null &&
      Date.now() - lastFetchedAt.value < staleMs &&
      !loading.value
    ) {
      return pendingCount.value
    }

    loading.value = true
    try {
      const res = await marketingApi.fetchPendingEmailTemplateApprovals()
      const list = Array.isArray(res.templates) ? res.templates : []
      setCount(list.length)
      lastFetchedAt.value = Date.now()
      return pendingCount.value
    } catch {
      // Keep last known count; badge is best-effort.
      return pendingCount.value
    } finally {
      loading.value = false
    }
  }

  return {
    pendingCount,
    loading,
    canFetch,
    showBadge,
    badgeLabel,
    setCount,
    syncFromTemplatesLength,
    refreshPendingCount
  }
}
