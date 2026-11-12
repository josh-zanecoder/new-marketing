import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('campaign Paste HTML insert image', () => {
  it('paste HTML editor uploads or inserts a URL into the existing code', () => {
    const page = readFileSync(
      resolve(root, 'app/components/client/emailTemlatesSelection.vue'),
      'utf8'
    )
    expect(page).toContain('Insert image')
    expect(page).toContain('Insert URL')
    expect(page).toContain('canInsertImage')
    expect(page).toContain('uploadEmailTemplateImage')
    expect(page).toContain('insertHtmlAtCursor')
    expect(page).toContain('emailHtmlImageTag')
    expect(page).toContain('parseInsertableImageUrl')
  })
})
