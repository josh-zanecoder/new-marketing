import {
  TEMPLATE_SAVE_ERROR_CONTENT,
  TEMPLATE_SAVE_ERROR_EMPTY_CONTENT,
  TEMPLATE_SAVE_ERROR_FALLBACK,
  TEMPLATE_SAVE_ERROR_GENERIC,
  TEMPLATE_SAVE_ERROR_NAME,
  TEMPLATE_SAVE_ERROR_NAME_REQUIRED,
  TEMPLATE_SAVE_ERROR_SUBJECT,
  TEMPLATE_SAVE_ERROR_SUBJECT_REQUIRED
} from '../constants/templateSaveError'

export type TemplateSaveErrorPresentation = {
  title: string
  body: string
  hint: string
}

/** Map a save failure string to calm, actionable dialog copy. */
export function resolveTemplateSaveErrorPresentation(
  message: string | null | undefined
): TemplateSaveErrorPresentation {
  const raw = String(message ?? '').trim()
  if (!raw || raw === TEMPLATE_SAVE_ERROR_NAME_REQUIRED) return { ...TEMPLATE_SAVE_ERROR_NAME }
  if (raw === TEMPLATE_SAVE_ERROR_SUBJECT_REQUIRED) return { ...TEMPLATE_SAVE_ERROR_SUBJECT }
  if (raw === TEMPLATE_SAVE_ERROR_EMPTY_CONTENT || /no content/i.test(raw)) {
    return { ...TEMPLATE_SAVE_ERROR_CONTENT }
  }
  if (raw === TEMPLATE_SAVE_ERROR_GENERIC) return { ...TEMPLATE_SAVE_ERROR_FALLBACK }
  return {
    title: TEMPLATE_SAVE_ERROR_FALLBACK.title,
    body: raw,
    hint: TEMPLATE_SAVE_ERROR_FALLBACK.hint
  }
}
