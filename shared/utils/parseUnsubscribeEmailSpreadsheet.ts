/**
 * Parse unsubscribe spreadsheet rows with an "Email" column
 * (header row), matching the bulk-unsubscribe template format.
 */

export type ParseUnsubscribeEmailSpreadsheetResult = {
  emails: string[]
  rowCount: number
  /** True when a column headed Email / email / E-mail was found. */
  foundEmailColumn: boolean
}

function cellString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).trim()
  return String(value).trim()
}

function isEmailHeader(value: unknown): boolean {
  const h = cellString(value).toLowerCase().replace(/[\s_-]+/g, '')
  return h === 'email' || h === 'emails' || h === 'e-mail' || h === 'emailaddress'
}

/**
 * @param rows - Sheet rows as arrays (including header). First matching Email column wins.
 */
export function extractEmailsFromSpreadsheetRows(
  rows: unknown[][]
): ParseUnsubscribeEmailSpreadsheetResult {
  if (!rows.length) {
    return { emails: [], rowCount: 0, foundEmailColumn: false }
  }

  const header = rows[0] || []
  let emailCol = -1
  for (let i = 0; i < header.length; i += 1) {
    if (isEmailHeader(header[i])) {
      emailCol = i
      break
    }
  }

  // Fallback: single-column sheet with no header — treat every non-empty cell as email.
  const dataStart = emailCol >= 0 ? 1 : 0
  if (emailCol < 0) {
    const firstColHasAt = rows.some((row, idx) => idx > 0 && cellString(row?.[0]).includes('@'))
    if (firstColHasAt) emailCol = 0
  }

  if (emailCol < 0) {
    return { emails: [], rowCount: Math.max(0, rows.length - 1), foundEmailColumn: false }
  }

  const emails: string[] = []
  for (let r = dataStart; r < rows.length; r += 1) {
    const email = cellString(rows[r]?.[emailCol])
    if (email) emails.push(email)
  }

  return {
    emails,
    rowCount: emails.length,
    foundEmailColumn: isEmailHeader(header[emailCol]) || dataStart === 1
  }
}
