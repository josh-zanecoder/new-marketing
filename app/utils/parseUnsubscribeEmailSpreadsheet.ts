import { extractEmailsFromSpreadsheetRows } from '~~/shared/utils/parseUnsubscribeEmailSpreadsheet'
export {
  extractEmailsFromSpreadsheetRows,
  type ParseUnsubscribeEmailSpreadsheetResult
} from '~~/shared/utils/parseUnsubscribeEmailSpreadsheet'

export async function parseUnsubscribeEmailSpreadsheetFile(
  file: File | Blob,
  fileName?: string
): Promise<import('~~/shared/utils/parseUnsubscribeEmailSpreadsheet').ParseUnsubscribeEmailSpreadsheetResult> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const name = (fileName || (file instanceof File ? file.name : '') || '').toLowerCase()
  const workbook = XLSX.read(buffer, {
    type: 'array',
    raw: false,
    codepage: name.endsWith('.csv') ? 65001 : undefined
  })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { emails: [], rowCount: 0, foundEmailColumn: false }
  }
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false
  }) as unknown[][]

  return extractEmailsFromSpreadsheetRows(rows)
}
