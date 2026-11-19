import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EMAIL_IMAGE_ROW_BLOCK_IDS,
  EMAIL_IMAGE_ROW_BLOCK_LABELS
} from '../../constants/emailImageRow'
import {
  emailImageRowBlockIds,
  rearrangeImageInRow,
  setupGrapesEmailImageRow,
  wrapAdjacentImages
} from '../grapesEmailImageRow'

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
    expect(typeof wrapAdjacentImages).toBe('function')
    expect(typeof rearrangeImageInRow).toBe('function')
  })

  it('wires the Grapes iframe builder and email-editor to setupGrapesEmailImageRow', () => {
    const grapesMain = readFileSync(resolve(root, 'grapes-builder/src/main.ts'), 'utf8')
    expect(grapesMain).toContain("from '../../shared/utils/grapesEmailImageRow'")
    expect(grapesMain).toContain('setupGrapesEmailImageRow(editor')

    const emailEditor = readFileSync(resolve(root, 'app/pages/tenant/email-editor/index.vue'), 'utf8')
    expect(emailEditor).toContain("from '~~/shared/utils/grapesEmailImageRow'")
    expect(emailEditor).toContain('setupGrapesEmailImageRow(editor)')
  })

  it('listens for drag end and component add so same-row drop works', () => {
    const source = readFileSync(resolve(root, 'shared/utils/grapesEmailImageRow.ts'), 'utf8')
    expect(source).toContain("editor.on('component:drag:end'")
    expect(source).toContain("editor.on('component:add'")
    expect(source).toContain('onGrapesEmailImagePlacement')
    expect(source).toContain('enableGrapesIndependentImageResize')
    expect(source).toContain('setupGrapesEmailImageBesideDrop')

    const resize = readFileSync(resolve(root, 'shared/utils/grapesEmailImageRowResize.ts'), 'utf8')
    expect(resize).toContain('emailImageIndependentWidthStyle')
    expect(resize).toContain('component:resize:end')

    const dnd = readFileSync(resolve(root, 'shared/utils/grapesEmailImageRowDnD.ts'), 'utf8')
    expect(dnd).toContain('wrapAdjacentImages')
    expect(dnd).toContain('rearrangeImageInRow')
    expect(dnd).toContain('applyPendingEmailImageBeside')

    const beside = readFileSync(resolve(root, 'shared/utils/grapesEmailImageRowBeside.ts'), 'utf8')
    expect(beside).toContain('EMAIL_IMAGE_BESIDE_HINT_LABEL')
    expect(beside).toContain('EMAIL_IMAGE_BESIDE_BODY_CLASS')
    expect(beside).toContain('applyPendingEmailImageBeside')
  })
})
