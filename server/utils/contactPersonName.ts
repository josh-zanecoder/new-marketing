/** Join `firstName` + `lastName` for display APIs and `recipient.name` in merge. */
export function formatContactFullName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ')
}

export function contactFirstLastFromDoc(doc: {
  firstName?: unknown
  lastName?: unknown
}): { firstName: string; lastName: string } {
  const fn = typeof doc.firstName === 'string' ? doc.firstName.trim() : ''
  const ln = typeof doc.lastName === 'string' ? doc.lastName.trim() : ''
  return { firstName: fn, lastName: ln }
}
