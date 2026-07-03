export const TENANT_TAB_CELL_CHAR_LIMIT = 16

/** Mobile card view — Name, Key, Label on recipient filters / dynamic variables */
export const MOBILE_RECORD_FIELD_CHAR_LIMIT = 150

export function truncateTabCellText(
  value: string | null | undefined,
  limit: number = TENANT_TAB_CELL_CHAR_LIMIT
): string {
  const text = String(value ?? '')
  if (!text) return ''
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}...`
}
