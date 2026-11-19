import { describe, expect, it } from 'vitest'
import { EMAIL_IMAGE_ALIGN_ATTR } from '../../constants/emailImageAlign'
import { updateEmailTemplateHtmlImageLayout } from '../emailTemplateHtmlImages'
import {
  readEmailTemplateHtmlImageAlign,
  updateEmailTemplateHtmlImageAlign
} from '../emailTemplateImageAlign'

describe('emailTemplateImageAlign', () => {
  const base =
    '<div><img src="a.png" alt="A" width="400" style="display:block;width:400px;max-width:100%;height:auto;border:0;" /></div>'

  it('defaults to left and sets center / right with email-safe margins', () => {
    expect(readEmailTemplateHtmlImageAlign(base, 0)).toBe('left')
    const center = updateEmailTemplateHtmlImageAlign(base, 0, 'center')
    expect(center).toContain(`${EMAIL_IMAGE_ALIGN_ATTR}="center"`)
    expect(center).toContain('align="center"')
    expect(center).toContain('margin-left: auto')
    expect(center).toContain('margin-right: auto')
    expect(readEmailTemplateHtmlImageAlign(center, 0)).toBe('center')

    const right = updateEmailTemplateHtmlImageAlign(base, 0, 'right')
    expect(right).toContain(`${EMAIL_IMAGE_ALIGN_ATTR}="right"`)
    expect(right).toContain('align="right"')
    expect(right).toContain('margin-left: auto')
    expect(right).toMatch(/margin-right:\s*0/)
    expect(readEmailTemplateHtmlImageAlign(right, 0)).toBe('right')
  })

  it('locks fluid full-width images so center/right are visible', () => {
    const fluid =
      '<div><img src="a.png" width="100%" style="display:block;width:100%;max-width:100%;height:auto;margin:0 auto;border:0;" /></div>'
    const center = updateEmailTemplateHtmlImageAlign(fluid, 0, 'center', { contentWidthPx: 600 })
    expect(center).toContain('width: 300px')
    expect(center).toContain('width="300"')
    expect(center).not.toMatch(/(?:^|[^-])width:\s*100%/)
    expect(center).toContain('margin-left: auto')
    expect(center).toContain('margin-right: auto')
    expect(center).not.toMatch(/margin:\s*0 auto/)
  })

  it('keeps align after a smaller resize', () => {
    const centered = updateEmailTemplateHtmlImageAlign(base, 0, 'center')
    const resized = updateEmailTemplateHtmlImageLayout(centered, 0, {
      width: 160,
      left: 0,
      top: 0,
      align: 'center'
    })
    expect(resized).toContain('width: 160px')
    expect(resized).toContain('width="160"')
    expect(resized).toContain(`${EMAIL_IMAGE_ALIGN_ATTR}="center"`)
    expect(resized).toContain('margin-left: auto')
    expect(resized).toContain('margin-right: auto')
    expect(readEmailTemplateHtmlImageAlign(resized, 0)).toBe('center')
  })

  it('leaves html unchanged for a missing image index', () => {
    expect(updateEmailTemplateHtmlImageAlign(base, 9, 'right')).toBe(base)
    expect(readEmailTemplateHtmlImageAlign(base, 9)).toBe('left')
  })
})
