import { describe, expect, it } from 'vitest'
import {
  TEMPLATE_BUILDER_HISTORY_MAX,
  TEMPLATE_BUILDER_HISTORY_META_DEBOUNCE_MS
} from '../templateBuilderHistory'

describe('templateBuilderHistory constants', () => {
  it('keeps a positive history cap and meta debounce', () => {
    expect(TEMPLATE_BUILDER_HISTORY_MAX).toBeGreaterThan(0)
    expect(TEMPLATE_BUILDER_HISTORY_META_DEBOUNCE_MS).toBeGreaterThan(0)
  })
})
