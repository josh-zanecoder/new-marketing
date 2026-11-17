/** Copy for Template Builder save validation / failure dialog. */

export const TEMPLATE_SAVE_ERROR_TITLE_DEFAULT = 'Couldn’t finish saving'

export const TEMPLATE_SAVE_ERROR_CONFIRM = 'Continue editing'

export const TEMPLATE_SAVE_ERROR_NAME_REQUIRED = 'Template name is required.'

export const TEMPLATE_SAVE_ERROR_SUBJECT_REQUIRED = 'Subject is required.'

export const TEMPLATE_SAVE_ERROR_EMPTY_CONTENT = 'This email has no content to save.'

export const TEMPLATE_SAVE_ERROR_GENERIC = 'Could not save this template. Please try again.'

/** Friendly presentation for known save failures. */
export const TEMPLATE_SAVE_ERROR_NAME = {
  title: 'Name this template',
  body: 'Every saved template needs a name so you can find it later in Email templates.',
  hint: 'Type a name in the Template name field at the top, then try Save again.'
} as const

export const TEMPLATE_SAVE_ERROR_SUBJECT = {
  title: 'Add a subject line',
  body: 'The subject is what people see in their inbox before they open the email.',
  hint: 'Fill in Subject at the top, then try Save again.'
} as const

export const TEMPLATE_SAVE_ERROR_CONTENT = {
  title: 'Nothing to save yet',
  body: 'This email doesn’t have content to store. Add text or an image, then save.',
  hint: 'Use the builder on the left to add blocks, then try again.'
} as const

export const TEMPLATE_SAVE_ERROR_FALLBACK = {
  title: TEMPLATE_SAVE_ERROR_TITLE_DEFAULT,
  body: 'Something went wrong while saving. Your edits are still in the editor.',
  hint: 'Check your connection and try Save again. If it keeps failing, refresh and reopen the template.'
} as const

/** @deprecated Prefer resolveTemplateSaveErrorPresentation — kept for older imports/tests. */
export const TEMPLATE_SAVE_ERROR_TITLE = TEMPLATE_SAVE_ERROR_TITLE_DEFAULT
