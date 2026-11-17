import {
  UNSAVED_TEMPLATE_CHANGES_DISCARD,
  UNSAVED_TEMPLATE_CHANGES_MESSAGE,
  UNSAVED_TEMPLATE_CHANGES_SAVE,
  UNSAVED_TEMPLATE_CHANGES_STAY,
  UNSAVED_TEMPLATE_CHANGES_TITLE
} from '~~/shared/constants/unsavedTemplateChanges'
import { createUnsavedTemplateGuardController } from '~~/shared/utils/unsavedTemplateGuardController'

/**
 * Promise-based unsaved-changes prompt for Template Builder.
 * When not dirty, allows immediately. When dirty: Stay cancels, Discard continues,
 * Save runs `onSave` and continues only if it succeeds.
 */
export function useUnsavedTemplateGuard() {
  const open = ref(false)
  const busy = ref(false)

  const controller = createUnsavedTemplateGuardController((state) => {
    open.value = state.open
    busy.value = state.busy
  })

  return {
    open,
    busy,
    title: UNSAVED_TEMPLATE_CHANGES_TITLE,
    message: UNSAVED_TEMPLATE_CHANGES_MESSAGE,
    stayText: UNSAVED_TEMPLATE_CHANGES_STAY,
    discardText: UNSAVED_TEMPLATE_CHANGES_DISCARD,
    saveText: UNSAVED_TEMPLATE_CHANGES_SAVE,
    confirmIfDirty: controller.confirmIfDirty,
    stay: controller.stay,
    discard: controller.discard,
    saveAndContinue: controller.saveAndContinue
  }
}
