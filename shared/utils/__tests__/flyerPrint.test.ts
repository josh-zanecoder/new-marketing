import { afterEach, describe, expect, it, vi } from 'vitest'
import { openFlyerForPrint } from '../flyerPrint'

describe('openFlyerForPrint', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns false when url and flyerId are empty', () => {
    expect(openFlyerForPrint({ url: '' })).toBe(false)
  })

  it('opens the same-origin flyer file URL for PDFs and schedules native print', () => {
    vi.useFakeTimers()
    const print = vi.fn()
    const focus = vi.fn()
    const addEventListener = vi.fn()
    const open = vi.fn(() => ({
      closed: false,
      print,
      focus,
      addEventListener,
      close: vi.fn()
    }))
    const setTimeoutSpy = vi.fn((fn: TimerHandler, ms?: number) =>
      globalThis.setTimeout(fn, ms)
    )
    vi.stubGlobal('window', { open, setTimeout: setTimeoutSpy })

    expect(
      openFlyerForPrint({
        url: 'https://storage.example/flyer.pdf',
        flyerId: 'flyer123',
        contentType: 'application/pdf'
      })
    ).toBe(true)

    expect(open).toHaveBeenCalledWith('/api/v1/tenant/flyers/flyer123/file', '_blank')
    expect(addEventListener).toHaveBeenCalledWith('load', expect.any(Function))
    expect(setTimeoutSpy).toHaveBeenCalled()

    for (const call of setTimeoutSpy.mock.calls) {
      const fn = call[0]
      if (typeof fn === 'function') fn()
    }
    expect(print).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
  })

  it('prints images via a blank HTML document instead of the raw file URL', () => {
    vi.useFakeTimers()
    const print = vi.fn()
    const focus = vi.fn()
    const close = vi.fn()
    const addEventListener = vi.fn()
    const img = {
      complete: true,
      addEventListener: vi.fn()
    }
    const documentWrite = vi.fn()
    const open = vi.fn(() => ({
      closed: false,
      print,
      focus,
      close,
      addEventListener,
      document: {
        open: vi.fn(),
        write: documentWrite,
        close: vi.fn(),
        querySelector: vi.fn(() => img)
      }
    }))
    const setTimeoutSpy = vi.fn((fn: TimerHandler, ms?: number) =>
      globalThis.setTimeout(fn, ms)
    )
    vi.stubGlobal('window', { open, setTimeout: setTimeoutSpy })

    expect(
      openFlyerForPrint({
        url: 'https://storage.example/flyer.png',
        flyerId: 'img1',
        name: 'Goldilocks',
        contentType: 'image/png'
      })
    ).toBe(true)

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(documentWrite).toHaveBeenCalled()
    const html = String(documentWrite.mock.calls[0]?.[0] ?? '')
    expect(html).toContain('/api/v1/tenant/flyers/img1/file')
    expect(html).toContain('@page { margin: 0;')

    for (const call of setTimeoutSpy.mock.calls) {
      const fn = call[0]
      if (typeof fn === 'function') fn()
    }
    expect(print).toHaveBeenCalled()
  })

  it('falls back to the hosted url when flyerId is missing for PDFs', () => {
    const open = vi.fn(() => ({
      closed: false,
      print: vi.fn(),
      focus: vi.fn(),
      addEventListener: vi.fn(),
      close: vi.fn()
    }))
    vi.stubGlobal('window', { open, setTimeout: vi.fn() })

    expect(
      openFlyerForPrint({
        url: 'https://storage.example/flyer.pdf',
        contentType: 'application/pdf'
      })
    ).toBe(true)
    expect(open).toHaveBeenCalledWith('https://storage.example/flyer.pdf', '_blank')
  })

  it('returns false when the popup is blocked', () => {
    vi.stubGlobal('window', { open: vi.fn(() => null) })
    expect(
      openFlyerForPrint({
        url: 'https://storage.example/flyer.pdf',
        flyerId: 'flyer123',
        contentType: 'application/pdf'
      })
    ).toBe(false)
  })
})
