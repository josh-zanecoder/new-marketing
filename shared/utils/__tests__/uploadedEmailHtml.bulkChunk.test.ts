import { describe, expect, it } from 'vitest'
import {
  BULK_EMAIL_TEMPLATES_MAX_PER_REQUEST,
  BULK_EMAIL_TEMPLATES_REQUEST_BYTE_BUDGET,
  chunkBulkEmailTemplatesForRequests,
  estimateBulkEmailTemplateRequestItemBytes,
  type BulkEmailTemplateRequestItem
} from '../uploadedEmailHtml'

function item(html: string, name = 't'): BulkEmailTemplateRequestItem {
  return { name, subject: name, htmlTemplate: html }
}

describe('chunkBulkEmailTemplatesForRequests', () => {
  it('keeps small templates in one chunk when under budget', () => {
    const templates = [item('<p>a</p>'), item('<p>b</p>'), item('<p>c</p>')]
    const chunks = chunkBulkEmailTemplatesForRequests(templates)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(3)
  })

  it('splits when count exceeds max per request', () => {
    const templates = Array.from({ length: BULK_EMAIL_TEMPLATES_MAX_PER_REQUEST + 3 }, (_, i) =>
      item(`<p>${i}</p>`, `n${i}`)
    )
    const chunks = chunkBulkEmailTemplatesForRequests(templates)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]).toHaveLength(BULK_EMAIL_TEMPLATES_MAX_PER_REQUEST)
    expect(chunks.flat()).toHaveLength(templates.length)
  })

  it('splits when estimated JSON bytes exceed budget', () => {
    const big = 'x'.repeat(Math.floor(BULK_EMAIL_TEMPLATES_REQUEST_BYTE_BUDGET / 2))
    const templates = [item(big, 'a'), item(big, 'b'), item(big, 'c')]
    const chunks = chunkBulkEmailTemplatesForRequests(templates, {
      byteBudget: BULK_EMAIL_TEMPLATES_REQUEST_BYTE_BUDGET,
      maxPerRequest: 50
    })
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    for (const chunk of chunks) {
      const body = JSON.stringify({ templates: chunk })
      expect(body.length).toBeLessThanOrEqual(BULK_EMAIL_TEMPLATES_REQUEST_BYTE_BUDGET + 64)
    }
  })

  it('estimates item size roughly as JSON length', () => {
    const row = item('<html>hi</html>', 'Hello')
    expect(estimateBulkEmailTemplateRequestItemBytes(row)).toBe(JSON.stringify(row).length)
  })
})
