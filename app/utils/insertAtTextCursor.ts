export function insertAtTextCursor(
  text: string,
  insert: string,
  selectionStart: number,
  selectionEnd: number
): { text: string; cursor: number } {
  const len = text.length
  const start = Math.max(0, Math.min(selectionStart, len))
  const end = Math.max(start, Math.min(selectionEnd, len))
  const next = `${text.slice(0, start)}${insert}${text.slice(end)}`
  return { text: next, cursor: start + insert.length }
}
