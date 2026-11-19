/**
 * GrapesJS wiring for side-by-side email images.
 * Thin façade — blocks / traits / resize / DnD live in sibling modules.
 */
import { EMAIL_IMAGE_ROW_BLOCK_IDS, EMAIL_IMAGE_ROW_COUNTS } from '../constants/emailImageRow'
import {
  hardenGrapesSingleImageBlock,
  registerGrapesEmailImageRowBlocks
} from './grapesEmailImageRowBlocks'
import {
  isGrapesEmailImageRowMerging,
  setupGrapesEmailImageBesideDrop
} from './grapesEmailImageRowBeside'
import {
  onGrapesEmailImagePlacement,
  rearrangeImageInRow,
  wrapAdjacentImages
} from './grapesEmailImageRowDnD'
import { enableGrapesIndependentImageResize } from './grapesEmailImageRowResize'
import { registerGrapesEmailImageRowComponent } from './grapesEmailImageRowTraits'
import {
  isGrapesImageComponent,
  resolveGrapesEventComponent,
  type GrapesComponent,
  type GrapesEditor
} from './grapesEmailImageRowTypes'

export { rearrangeImageInRow, wrapAdjacentImages }

const PLACEMENT_RETRY_MS = [0, 50, 120, 250]

function scheduleImagePlacement(component: GrapesComponent | undefined) {
  if (!component || !isGrapesImageComponent(component)) return
  if (isGrapesEmailImageRowMerging()) return

  for (const delay of PLACEMENT_RETRY_MS) {
    window.setTimeout(() => {
      if (isGrapesEmailImageRowMerging()) return
      // Component may already have been removed/merged by an earlier retry.
      if (!component.getEl?.() && !component.parent?.()) return
      onGrapesEmailImagePlacement(component)
    }, delay)
  }
}

/** Register side-by-side image blocks, traits, resize, rearrange, and auto-wrap on drag/add. */
export function setupGrapesEmailImageRow(
  editor: GrapesEditor,
  options?: { placeholderSrc?: string }
): void {
  const placeholderSrc = options?.placeholderSrc
  registerGrapesEmailImageRowComponent(editor)
  enableGrapesIndependentImageResize(editor)
  registerGrapesEmailImageRowBlocks(editor, placeholderSrc)
  hardenGrapesSingleImageBlock(editor, placeholderSrc)
  setupGrapesEmailImageBesideDrop(editor)

  editor.on('component:drag:end', (...args: unknown[]) => {
    scheduleImagePlacement(resolveGrapesEventComponent(args))
  })
  editor.on('component:add', (...args: unknown[]) => {
    const component =
      resolveGrapesEventComponent(args) || (args[0] as GrapesComponent | undefined)
    scheduleImagePlacement(component)
  })
}

export function emailImageRowBlockIds(): string[] {
  return EMAIL_IMAGE_ROW_COUNTS.map((count) => {
    if (count === 2) return EMAIL_IMAGE_ROW_BLOCK_IDS.two
    if (count === 3) return EMAIL_IMAGE_ROW_BLOCK_IDS.three
    return EMAIL_IMAGE_ROW_BLOCK_IDS.four
  })
}
