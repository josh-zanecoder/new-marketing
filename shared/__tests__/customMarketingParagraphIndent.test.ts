import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { nextParagraphIndentLevel } from '../customMarketingParagraphIndent'

describe('customMarketingParagraphIndent', () => {
  it('increments and decrements indent levels within bounds', () => {
    assert.equal(nextParagraphIndentLevel(0, 'in'), 1)
    assert.equal(nextParagraphIndentLevel(7, 'in'), 8)
    assert.equal(nextParagraphIndentLevel(8, 'in'), 8)
    assert.equal(nextParagraphIndentLevel(2, 'out'), 1)
    assert.equal(nextParagraphIndentLevel(0, 'out'), 0)
  })
})
