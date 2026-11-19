import { describe, expect, it } from 'vitest'
import {
  clampEmailImageWidthPct,
  emailImageIndependentWidthStyle,
  pxWidthToCellPercent
} from '../emailImageRowWidth'

describe('emailImageRowWidth', () => {
  it('clamps per-image width percent', () => {
    expect(clampEmailImageWidthPct(50)).toBe(50)
    expect(clampEmailImageWidthPct(1)).toBe(10)
    expect(clampEmailImageWidthPct(200)).toBe(100)
    expect(clampEmailImageWidthPct('bad')).toBe(100)
  })

  it('builds independent styles that cannot overlap siblings', () => {
    const style = emailImageIndependentWidthStyle(40)
    expect(style.width).toBe('40%')
    expect(style['max-width']).toBe('100%')
    expect(style.height).toBe('auto')
    expect(style.display).toBe('block')
    expect(style.float).toBe('none')
    expect(style.position).toBe('static')
  })

  it('converts px resize into a percent of the cell', () => {
    expect(pxWidthToCellPercent(100, 200)).toBe(50)
    expect(pxWidthToCellPercent(50, 0)).toBe(100)
  })
})
