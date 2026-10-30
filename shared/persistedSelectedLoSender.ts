/**
 * Already-saved campaigns with `senderMode: selected` keep that fixed From on send,
 * even if the superadmin later turns `allowTenantEditSender` off (toggle gates create/edit only).
 */
export function shouldUsePersistedSelectedLoSender(params: {
  senderMode?: string | null
  senderEmail?: string | null
}): boolean {
  if (params.senderMode !== 'selected') return false
  return Boolean(String(params.senderEmail ?? '').trim())
}
