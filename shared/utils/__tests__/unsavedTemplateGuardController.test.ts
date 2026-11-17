import { describe, expect, it, vi } from 'vitest'
import { createUnsavedTemplateGuardController } from '../unsavedTemplateGuardController'

describe('createUnsavedTemplateGuardController', () => {
  it('skips the dialog when there are no unsaved changes', async () => {
    const guard = createUnsavedTemplateGuardController()
    await expect(guard.confirmIfDirty(false)).resolves.toBe(true)
    expect(guard.getState().open).toBe(false)
  })

  it('cancels when the user stays', async () => {
    const guard = createUnsavedTemplateGuardController()
    const promise = guard.confirmIfDirty(true)
    expect(guard.getState().open).toBe(true)
    guard.stay()
    await expect(promise).resolves.toBe(false)
    expect(guard.getState().open).toBe(false)
  })

  it('continues when the user discards', async () => {
    const guard = createUnsavedTemplateGuardController()
    const promise = guard.confirmIfDirty(true)
    guard.discard()
    await expect(promise).resolves.toBe(true)
  })

  it('saves then continues only when onSave succeeds', async () => {
    const guard = createUnsavedTemplateGuardController()
    const onSave = vi.fn().mockResolvedValue(false)
    const blocked = guard.confirmIfDirty(true, { onSave })
    await guard.saveAndContinue()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(guard.getState().open).toBe(true)

    onSave.mockResolvedValue(true)
    await guard.saveAndContinue()
    await expect(blocked).resolves.toBe(true)
    expect(guard.getState().open).toBe(false)
  })
})
