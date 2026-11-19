import {
  EMAIL_IMAGE_ROW_BLOCK_CATEGORY,
  EMAIL_IMAGE_ROW_BLOCK_IDS,
  EMAIL_IMAGE_ROW_BLOCK_LABELS,
  EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
  EMAIL_IMAGE_WIDTH_DEFAULT_PCT,
  type EmailImageRowCount
} from '../constants/emailImageRow'
import { emailImageRowHtml } from './emailImageRow'
import { emailImageIndependentWidthStyle } from './emailImageRowWidth'
import type { GrapesEditor } from './grapesEmailImageRowTypes'

const TWO_MEDIA =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h8v14H3V5zm10 0h8v14h-8V5zM2 4v16a1 1 0 001 1h8a1 1 0 001-1V4a1 1 0 00-1-1H3a1 1 0 00-1 1zm10 0v16a1 1 0 001 1h8a1 1 0 001-1V4a1 1 0 00-1-1h-8a1 1 0 00-1 1z"/></svg>'

const THREE_MEDIA =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 5h6v14H2V5zm8 0h4v14h-4V5zm6 0h6v14h-6V5z"/></svg>'

/** Four side-by-side columns (same row), not a 2×2 grid. */
const FOUR_MEDIA =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 5h4v14H2V5zm5.5 0h4v14h-4V5zM13 5h4v14h-4V5zm5.5 0H22v14h-3.5V5z"/></svg>'

export function registerGrapesEmailImageRowBlocks(
  editor: GrapesEditor,
  placeholderSrc?: string
): void {
  const add = (id: string, label: string, count: EmailImageRowCount, media: string) => {
    editor.BlockManager.add(id, {
      label,
      category: EMAIL_IMAGE_ROW_BLOCK_CATEGORY,
      media,
      content: emailImageRowHtml({
        count,
        placeholderSrc,
        spacingPx: EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
        align: 'center',
        valign: 'top'
      })
    })
  }

  add(EMAIL_IMAGE_ROW_BLOCK_IDS.two, EMAIL_IMAGE_ROW_BLOCK_LABELS.two, 2, TWO_MEDIA)
  add(EMAIL_IMAGE_ROW_BLOCK_IDS.three, EMAIL_IMAGE_ROW_BLOCK_LABELS.three, 3, THREE_MEDIA)
  add(EMAIL_IMAGE_ROW_BLOCK_IDS.four, EMAIL_IMAGE_ROW_BLOCK_LABELS.four, 4, FOUR_MEDIA)
}

export function hardenGrapesSingleImageBlock(
  editor: GrapesEditor,
  placeholderSrc?: string
): void {
  const imageBlock = editor.BlockManager.get('image')
  if (!imageBlock) return
  imageBlock.set({
    activate: false,
    select: true,
    content: {
      type: 'image',
      attributes: { src: placeholderSrc || '', alt: 'Image' },
      style: emailImageIndependentWidthStyle(EMAIL_IMAGE_WIDTH_DEFAULT_PCT)
    }
  })
}
