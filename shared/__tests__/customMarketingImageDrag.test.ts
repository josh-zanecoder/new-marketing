import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  firstImageFileFromDataTransfer,
  shouldAcceptExternalImageDrop
} from '../customMarketingImageDrag'

describe('customMarketingImageDrag', () => {
  it('rejects internal node moves so images can be repositioned', () => {
    const event = {
      dataTransfer: {
        files: [{ type: 'image/jpeg', name: 'x.jpg' }]
      }
    } as unknown as DragEvent
    assert.equal(shouldAcceptExternalImageDrop(true, event), false)
  })

  it('accepts external image file drops', () => {
    const file = { type: 'image/png', name: 'a.png' } as File
    const event = {
      dataTransfer: { files: [file] }
    } as unknown as DragEvent
    assert.equal(shouldAcceptExternalImageDrop(false, event), true)
    assert.equal(firstImageFileFromDataTransfer(event.dataTransfer), file)
  })

  it('ignores non-image external drops', () => {
    const event = {
      dataTransfer: { files: [{ type: 'text/plain', name: 'a.txt' }] }
    } as unknown as DragEvent
    assert.equal(shouldAcceptExternalImageDrop(false, event), false)
  })
})
