import { describe, expect, it } from 'vitest'
import { createTemplateBuilderHistory } from '../templateBuilderHistory'

function snap(html: string, name = 'n', subject = 's') {
  return { html, name, subject }
}

describe('createTemplateBuilderHistory', () => {
  it('starts with no undo/redo after reset', () => {
    const h = createTemplateBuilderHistory()
    h.reset(snap('a'))
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
    expect(h.getPresent()).toEqual(snap('a'))
  })

  it('undoes and redoes consecutive commits', () => {
    const h = createTemplateBuilderHistory()
    h.reset(snap('a'))
    h.commit(snap('b'))
    h.commit(snap('c'))
    expect(h.undo()).toEqual(snap('b'))
    expect(h.undo()).toEqual(snap('a'))
    expect(h.canUndo()).toBe(false)
    expect(h.redo()).toEqual(snap('b'))
    expect(h.redo()).toEqual(snap('c'))
    expect(h.canRedo()).toBe(false)
  })

  it('clears redo when a new edit is committed after undo', () => {
    const h = createTemplateBuilderHistory()
    h.reset(snap('a'))
    h.commit(snap('b'))
    h.undo()
    h.commit(snap('z'))
    expect(h.canRedo()).toBe(false)
    expect(h.getPresent()).toEqual(snap('z'))
    expect(h.undo()).toEqual(snap('a'))
  })

  it('ignores duplicate commits', () => {
    const h = createTemplateBuilderHistory()
    h.reset(snap('a'))
    h.commit(snap('a'))
    expect(h.canUndo()).toBe(false)
  })

  it('caps history length', () => {
    const h = createTemplateBuilderHistory(2)
    h.reset(snap('0'))
    h.commit(snap('1'))
    h.commit(snap('2'))
    h.commit(snap('3'))
    expect(h.undo()).toEqual(snap('2'))
    expect(h.undo()).toEqual(snap('1'))
    expect(h.canUndo()).toBe(false)
  })
})
