import { TEMPLATE_BUILDER_HISTORY_MAX } from '../constants/templateBuilderHistory'

export type TemplateBuilderHistorySnapshot = {
  html: string
  name: string
  subject: string
}

export type TemplateBuilderHistory = {
  reset: (snapshot: TemplateBuilderHistorySnapshot) => void
  /** Record a new present state; previous present goes onto the undo stack. */
  commit: (snapshot: TemplateBuilderHistorySnapshot) => void
  undo: () => TemplateBuilderHistorySnapshot | null
  redo: () => TemplateBuilderHistorySnapshot | null
  canUndo: () => boolean
  canRedo: () => boolean
  getPresent: () => TemplateBuilderHistorySnapshot | null
}

function same(
  a: TemplateBuilderHistorySnapshot,
  b: TemplateBuilderHistorySnapshot
): boolean {
  return a.html === b.html && a.name === b.name && a.subject === b.subject
}

function copy(snapshot: TemplateBuilderHistorySnapshot): TemplateBuilderHistorySnapshot {
  return { html: snapshot.html, name: snapshot.name, subject: snapshot.subject }
}

/** Pure undo/redo stack for Template Builder document state. */
export function createTemplateBuilderHistory(
  maxEntries: number = TEMPLATE_BUILDER_HISTORY_MAX
): TemplateBuilderHistory {
  const max = Math.max(1, maxEntries)
  let past: TemplateBuilderHistorySnapshot[] = []
  let present: TemplateBuilderHistorySnapshot | null = null
  let future: TemplateBuilderHistorySnapshot[] = []

  function reset(snapshot: TemplateBuilderHistorySnapshot) {
    past = []
    future = []
    present = copy(snapshot)
  }

  function commit(snapshot: TemplateBuilderHistorySnapshot) {
    if (!present) {
      present = copy(snapshot)
      future = []
      return
    }
    if (same(present, snapshot)) return
    past.push(present)
    while (past.length > max) past.shift()
    present = copy(snapshot)
    future = []
  }

  function undo(): TemplateBuilderHistorySnapshot | null {
    if (!present || !past.length) return null
    future.unshift(present)
    present = past.pop()!
    return copy(present)
  }

  function redo(): TemplateBuilderHistorySnapshot | null {
    if (!present || !future.length) return null
    past.push(present)
    present = future.shift()!
    return copy(present)
  }

  return {
    reset,
    commit,
    undo,
    redo,
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    getPresent: () => (present ? copy(present) : null)
  }
}
