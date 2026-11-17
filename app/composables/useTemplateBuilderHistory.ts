import {
  TEMPLATE_BUILDER_HISTORY_MAX,
  TEMPLATE_BUILDER_HISTORY_META_DEBOUNCE_MS
} from '~~/shared/constants/templateBuilderHistory'
import {
  createTemplateBuilderHistory,
  type TemplateBuilderHistorySnapshot
} from '~~/shared/utils/templateBuilderHistory'

type HistoryRefs = {
  html: Ref<string>
  name: Ref<string>
  subject: Ref<string>
}

/**
 * Undo/redo for Template Builder document state (HTML + name + subject).
 * HTML commits immediately; name/subject commits are debounced while typing.
 */
export function useTemplateBuilderHistory(refs: HistoryRefs) {
  const history = createTemplateBuilderHistory(TEMPLATE_BUILDER_HISTORY_MAX)
  const canUndo = ref(false)
  const canRedo = ref(false)
  const applying = ref(false)
  let metaTimer: ReturnType<typeof setTimeout> | null = null
  let started = false

  function snapshot(): TemplateBuilderHistorySnapshot {
    return {
      html: refs.html.value,
      name: refs.name.value,
      subject: refs.subject.value
    }
  }

  function syncFlags() {
    canUndo.value = history.canUndo()
    canRedo.value = history.canRedo()
  }

  function applySnapshot(next: TemplateBuilderHistorySnapshot) {
    applying.value = true
    refs.html.value = next.html
    refs.name.value = next.name
    refs.subject.value = next.subject
    syncFlags()
    // Two ticks: builder may prune/emit once after modelValue updates.
    void nextTick(() => {
      void nextTick(() => {
        applying.value = false
      })
    })
  }

  function resetFromCurrent() {
    if (metaTimer) {
      clearTimeout(metaTimer)
      metaTimer = null
    }
    history.reset(snapshot())
    syncFlags()
    started = true
  }

  function commitNow() {
    if (!started || applying.value) return
    history.commit(snapshot())
    syncFlags()
  }

  function scheduleMetaCommit() {
    if (!started || applying.value) return
    if (metaTimer) clearTimeout(metaTimer)
    metaTimer = setTimeout(() => {
      metaTimer = null
      commitNow()
    }, TEMPLATE_BUILDER_HISTORY_META_DEBOUNCE_MS)
  }

  function undo() {
    if (metaTimer) {
      clearTimeout(metaTimer)
      metaTimer = null
      commitNow()
    }
    const prev = history.undo()
    if (!prev) return
    applySnapshot(prev)
  }

  function redo() {
    if (metaTimer) {
      clearTimeout(metaTimer)
      metaTimer = null
    }
    const next = history.redo()
    if (!next) return
    applySnapshot(next)
  }

  watch(
    () => refs.html.value,
    () => {
      if (!started || applying.value) return
      commitNow()
    }
  )

  watch([() => refs.name.value, () => refs.subject.value], () => {
    if (!started || applying.value) return
    scheduleMetaCommit()
  })

  onBeforeUnmount(() => {
    if (metaTimer) clearTimeout(metaTimer)
  })

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    resetFromCurrent
  }
}
