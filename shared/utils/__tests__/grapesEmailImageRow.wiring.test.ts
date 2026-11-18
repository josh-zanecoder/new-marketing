import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EMAIL_IMAGE_ROW_BLOCK_IDS,
  EMAIL_IMAGE_ROW_BLOCK_LABELS
} from '../../constants/emailImageRow'
import { emailImageRowBlockIds, setupGrapesEmailImageRow } from '../grapesEmailImageRow'

const root = resolve(__dirname, '../../..')

describe('grapesEmailImageRow wiring', () => {
  it('exports the side-by-side block ids used in the builder', () => {
    expect(emailImageRowBlockIds()).toEqual([
      EMAIL_IMAGE_ROW_BLOCK_IDS.two,
      EMAIL_IMAGE_ROW_BLOCK_IDS.three,
      EMAIL_IMAGE_ROW_BLOCK_IDS.four
    ])
    expect(EMAIL_IMAGE_ROW_BLOCK_LABELS.two).toBe('2 Images')
    expect(typeof setupGrapesEmailImageRow).toBe('function')
  })

  it('wires the Grapes iframe builder and email-editor to setupGrapesEmailImageRow', () => {
    const grapesMain = readFileSync(resolve(root, 'grapes-builder/src/main.ts'), 'utf8')
    expect(grapesMain).toContain("from '../../shared/utils/grapesEmailImageRow'")
    expect(grapesMain).toContain('setupGrapesEmailImageRow(editor')

    const emailEditor = readFileSync(resolve(root, 'app/pages/tenant/email-editor/index.vue'), 'utf8')
    expect(emailEditor).toContain("from '~~/shared/utils/grapesEmailImageRow'")
    expect(emailEditor).toContain('setupGrapesEmailImageRow(editor)')
  })
})
