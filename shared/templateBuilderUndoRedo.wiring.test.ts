import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('template builder undo/redo wiring', () => {
  it('page exposes undo/redo controls and keyboard shortcuts', () => {
    const page = readFileSync(resolve(root, 'app/pages/tenant/template-builder/index.vue'), 'utf8')
    expect(page).toContain('useTemplateBuilderHistory')
    expect(page).toContain('resetEditHistory')
    expect(page).toContain('aria-label="Undo"')
    expect(page).toContain('aria-label="Redo"')
    expect(page).toContain(':disabled="saving || status !== \'ready\' || !canUndo"')
    expect(page).toContain(':disabled="saving || status !== \'ready\' || !canRedo"')
    expect(page).toContain('onHistoryKeydown')
    expect(page).toContain("key === 'z'")
  })

  it('composable commits html immediately and metas on debounce', () => {
    const composable = readFileSync(
      resolve(root, 'app/composables/useTemplateBuilderHistory.ts'),
      'utf8'
    )
    expect(composable).toContain('createTemplateBuilderHistory')
    expect(composable).toContain('TEMPLATE_BUILDER_HISTORY_META_DEBOUNCE_MS')
    expect(composable).toContain('scheduleMetaCommit')
    expect(composable).toContain('commitNow')
  })
})
