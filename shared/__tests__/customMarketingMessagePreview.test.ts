import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  renderCustomMarketingPreviewTemplate,
  shouldApplyCustomMarketingPreviewMerge,
  shouldCloseCustomMarketingMessagePreview
} from '../customMarketingMessagePreview'

describe('customMarketingMessagePreview', () => {
  it('closes on Escape only when the preview modal is open', () => {
    assert.equal(shouldCloseCustomMarketingMessagePreview('Escape', false), false)
    assert.equal(shouldCloseCustomMarketingMessagePreview('Enter', true), false)
    assert.equal(shouldCloseCustomMarketingMessagePreview('Escape', true), true)
  })

  it('applies merge only when a recipient list id is present', () => {
    assert.equal(shouldApplyCustomMarketingPreviewMerge(''), false)
    assert.equal(shouldApplyCustomMarketingPreviewMerge('  '), false)
    assert.equal(shouldApplyCustomMarketingPreviewMerge('abc123'), true)
  })

  it('keeps raw tags when no list is selected', () => {
    const template = 'Dear {{ recipient.firstName }},'
    const root = { recipient: { firstName: 'Ada' } }
    assert.equal(renderCustomMarketingPreviewTemplate(template, root, ''), template)
  })

  it('fills tags from the first-recipient merge root when a list is selected', () => {
    const template = 'Dear {{ recipient.firstName }}, from {{ user.firstName }}'
    const root = {
      recipient: { firstName: 'Ada' },
      user: { firstName: 'Josh' }
    }
    assert.equal(
      renderCustomMarketingPreviewTemplate(template, root, 'list-1'),
      'Dear Ada, from Josh'
    )
  })
})
