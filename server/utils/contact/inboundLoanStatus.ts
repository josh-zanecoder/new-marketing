import { normalizeLendingQbStatus } from '~~/shared/lendingQbStatusCategories'

export type InboundLoanStatusFields = {
  loanStatus?: string
  loanStatusKey?: string
  loanStatusUpdatedAt?: Date
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Read the optional LendingQB loan status off an inbound contact payload.
 * Returns `{}` when the event carries none (so the stored loan status is left untouched).
 * `fallbackAt` (the event `occurredAt`) is used when the CRM did not send `loanStatusUpdatedAt`.
 */
export function readInboundLoanStatusFields(
  payload: Record<string, unknown>,
  fallbackAt: unknown
): InboundLoanStatusFields {
  const raw = typeof payload.loanStatus === 'string' ? payload.loanStatus.trim() : ''
  if (!raw) return {}
  const key = normalizeLendingQbStatus(raw)
  if (!key) return {}
  const at = parseDate(payload.loanStatusUpdatedAt) ?? parseDate(fallbackAt) ?? new Date()
  return { loanStatus: raw, loanStatusKey: key, loanStatusUpdatedAt: at }
}
