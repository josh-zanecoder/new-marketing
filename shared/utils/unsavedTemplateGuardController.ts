/**
 * Framework-free controller for the Template Builder unsaved-changes dialog.
 * The Vue composable wraps this with refs for the UI.
 */

export type UnsavedTemplateGuardState = {
  open: boolean
  busy: boolean
}

export type UnsavedTemplateGuardController = {
  getState: () => UnsavedTemplateGuardState
  confirmIfDirty: (
    isDirty: boolean,
    options?: { onSave?: () => Promise<boolean> }
  ) => Promise<boolean>
  stay: () => void
  discard: () => void
  saveAndContinue: () => Promise<void>
}

export function createUnsavedTemplateGuardController(
  onStateChange?: (state: UnsavedTemplateGuardState) => void
): UnsavedTemplateGuardController {
  let open = false
  let busy = false
  let pendingResolve: ((allowed: boolean) => void) | null = null
  let onSaveHandler: (() => Promise<boolean>) | null = null

  function emit() {
    onStateChange?.({ open, busy })
  }

  function finish(allowed: boolean) {
    open = false
    busy = false
    onSaveHandler = null
    const resolve = pendingResolve
    pendingResolve = null
    emit()
    resolve?.(allowed)
  }

  function confirmIfDirty(
    isDirty: boolean,
    options?: { onSave?: () => Promise<boolean> }
  ): Promise<boolean> {
    if (!isDirty) return Promise.resolve(true)
    if (pendingResolve) {
      pendingResolve(false)
      pendingResolve = null
    }
    onSaveHandler = options?.onSave ?? null
    open = true
    busy = false
    emit()
    return new Promise((resolve) => {
      pendingResolve = resolve
    })
  }

  function stay() {
    if (busy) return
    finish(false)
  }

  function discard() {
    if (busy) return
    finish(true)
  }

  async function saveAndContinue() {
    if (busy) return
    if (!onSaveHandler) {
      finish(true)
      return
    }
    busy = true
    emit()
    try {
      const ok = await onSaveHandler()
      if (ok) finish(true)
      else {
        busy = false
        emit()
      }
    } catch {
      busy = false
      emit()
    }
  }

  return {
    getState: () => ({ open, busy }),
    confirmIfDirty,
    stay,
    discard,
    saveAndContinue
  }
}
