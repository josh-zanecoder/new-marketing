export const TENANT_TAB_CELL_CHAR_LIMIT = 16

export function truncateTabCellText(
  value: string | null | undefined,
  limit: number = TENANT_TAB_CELL_CHAR_LIMIT
): string {
  const text = String(value ?? '')
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}...`
}
