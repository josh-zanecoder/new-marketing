import { describe, expect, it } from 'vitest'
import {
  findEmailImageBesideHit,
  findEmailImageBesidePartnerAfterStack,
  mapParentPointToFrame
} from '../emailImageBesideHit'

describe('emailImageBesideHit', () => {
  it('maps parent pointer into the iframe viewport', () => {
    expect(mapParentPointToFrame(500, 300, { left: 100, top: 50 })).toEqual({ x: 400, y: 250 })
  })

  it('treats any point on the image as left or right beside', () => {
    const rects = [{ id: 'img-a', left: 100, top: 80, width: 200, height: 120 }]
    expect(findEmailImageBesideHit(110, 100, rects)).toEqual({ id: 'img-a', side: 'left' })
    expect(findEmailImageBesideHit(200, 100, rects)).toEqual({ id: 'img-a', side: 'right' })
    expect(findEmailImageBesideHit(280, 100, rects)).toEqual({ id: 'img-a', side: 'right' })
    expect(findEmailImageBesideHit(50, 100, rects)).toBeNull()
  })

  it('joins a stacked drop to a nearby image without needing a pointer', () => {
    const partner = findEmailImageBesidePartnerAfterStack({
      dropped: { id: 'new', left: 100, top: 20, width: 200, height: 40 },
      others: [{ id: 'img-a', left: 100, top: 80, width: 200, height: 120 }],
      pointer: null
    })
    expect(partner).toEqual({ id: 'img-a', side: 'right' })
  })
})
