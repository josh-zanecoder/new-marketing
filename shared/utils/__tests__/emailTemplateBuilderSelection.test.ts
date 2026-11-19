import { describe, expect, it } from 'vitest'
import {
  selectionClearOnSidePanelChange,
  toggleSelectionId
} from '../emailTemplateBuilderSelection'

describe('toggleSelectionId', () => {
  it('selects when nothing is active', () => {
    expect(toggleSelectionId(null, 2)).toBe(2)
  })

  it('deselects when clicking the active id again', () => {
    expect(toggleSelectionId(2, 2)).toBe(null)
  })

  it('switches to another id', () => {
    expect(toggleSelectionId(1, 3)).toBe(3)
  })
})

describe('selectionClearOnSidePanelChange', () => {
  it('clears section selection when leaving Sections', () => {
    expect(selectionClearOnSidePanelChange('layout', 'email')).toEqual({
      clearSection: true,
      clearImage: false
    })
    expect(selectionClearOnSidePanelChange('layout', 'add')).toEqual({
      clearSection: true,
      clearImage: false
    })
  })

  it('clears image selection when leaving Images', () => {
    expect(selectionClearOnSidePanelChange('email', 'layout')).toEqual({
      clearSection: false,
      clearImage: true
    })
  })

  it('does not clear when staying on the same tab', () => {
    expect(selectionClearOnSidePanelChange('layout', 'layout')).toEqual({
      clearSection: false,
      clearImage: false
    })
  })
})
