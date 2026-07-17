import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CUSTOM_MARKETING_EDITOR_TIPS,
  CUSTOM_MARKETING_EDITOR_TIPS_HEADING
} from '../customMarketingEditorTips'

describe('customMarketingEditorTips', () => {
  it('has a heading and four tip cards', () => {
    assert.ok(CUSTOM_MARKETING_EDITOR_TIPS_HEADING.trim().length > 0)
    assert.equal(CUSTOM_MARKETING_EDITOR_TIPS.length, 4)
  })

  it('uses unique ids and includes preview + variables examples', () => {
    const ids = CUSTOM_MARKETING_EDITOR_TIPS.map((t) => t.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(ids.includes('preview'))
    assert.ok(ids.includes('variables'))
    const variables = CUSTOM_MARKETING_EDITOR_TIPS.find((t) => t.id === 'variables')
    assert.equal(variables?.example, '{{ recipient.firstName }}')
  })
})
