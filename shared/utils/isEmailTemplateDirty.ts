export type EmailTemplateDirtySnapshot = {
  html: string
  name: string
  subject: string
}

/**
 * True when the editor differs from the last saved (or loaded) snapshot.
 * Compares trimmed name/subject; HTML is compared as stored in the editor.
 */
export function isEmailTemplateDirty(
  current: EmailTemplateDirtySnapshot,
  saved: EmailTemplateDirtySnapshot
): boolean {
  return (
    current.html !== saved.html
    || current.name.trim() !== saved.name.trim()
    || current.subject.trim() !== saved.subject.trim()
  )
}
