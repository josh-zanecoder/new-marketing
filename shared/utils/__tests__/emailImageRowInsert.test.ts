import { describe, expect, it } from 'vitest'
import { buildTwoImageRowSrcs, insertSrcBesideInEmailImageRow } from '../emailImageRowInsert'

describe('emailImageRowInsert', () => {
  it('builds a 2-image row from a beside drop', () => {
    expect(buildTwoImageRowSrcs('a', 'b', 'right')).toEqual(['a', 'b'])
    expect(buildTwoImageRowSrcs('a', 'b', 'left')).toEqual(['b', 'a'])
  })

  it('grows a 2-image row to 3 and 4 on the chosen side', () => {
    const three = insertSrcBesideInEmailImageRow({
      existingSrcs: ['a', 'b'],
      partnerIndex: 1,
      newSrc: 'c',
      side: 'right'
    })
    expect(three).toEqual({ srcs: ['a', 'b', 'c'], count: 3 })

    const threeLeft = insertSrcBesideInEmailImageRow({
      existingSrcs: ['a', 'b'],
      partnerIndex: 0,
      newSrc: 'c',
      side: 'left'
    })
    expect(threeLeft).toEqual({ srcs: ['c', 'a', 'b'], count: 3 })

    const four = insertSrcBesideInEmailImageRow({
      existingSrcs: ['a', 'b', 'c'],
      partnerIndex: 1,
      newSrc: 'd',
      side: 'right'
    })
    expect(four).toEqual({ srcs: ['a', 'b', 'd', 'c'], count: 4 })
  })

  it('refuses a 5th image in the same row', () => {
    expect(
      insertSrcBesideInEmailImageRow({
        existingSrcs: ['a', 'b', 'c', 'd'],
        partnerIndex: 0,
        newSrc: 'e',
        side: 'right'
      })
    ).toBeNull()
  })
})
