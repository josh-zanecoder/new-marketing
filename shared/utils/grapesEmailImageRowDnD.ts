import {
  EMAIL_IMAGE_ROW_ATTR,
  EMAIL_IMAGE_ROW_CELL_ATTR,
  EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
  EMAIL_IMAGE_WIDTH_DEFAULT_PCT,
  EMAIL_IMAGE_WIDTH_TRAIT,
  type EmailImageRowCount
} from '../constants/emailImageRow'
import { emailImageRowHtml } from './emailImageRow'
import {
  applyPendingEmailImageBeside,
  isGrapesEmailImageRowMerging,
  mergeEmailImagesSideBySide
} from './grapesEmailImageRowBeside'
import {
  findGrapesAncestorWithAttr,
  isGrapesImageComponent,
  type GrapesComponent
} from './grapesEmailImageRowTypes'

function imageSrc(component: GrapesComponent): string {
  return String((component.getAttributes() as { src?: string }).src || '')
}

function collectSiblingImages(parent: GrapesComponent): GrapesComponent[] {
  const collection = parent.components()
  const images: GrapesComponent[] = []
  for (let i = 0; i < collection.length; i += 1) {
    const child = collection.at(i)
    if (isGrapesImageComponent(child)) images.push(child!)
  }
  return images
}

function listImagesInCell(cell: GrapesComponent): GrapesComponent[] {
  const direct = collectSiblingImages(cell)
  if (direct.length) return direct
  return cell.find('img').filter((node) => isGrapesImageComponent(node))
}

function swapImagePayload(a: GrapesComponent, b: GrapesComponent) {
  const aAttrs = { ...a.getAttributes() }
  const bAttrs = { ...b.getAttributes() }
  const aStyle = { ...(a.getStyle?.() || {}) }
  const bStyle = { ...(b.getStyle?.() || {}) }
  const aWidth = a.get(EMAIL_IMAGE_WIDTH_TRAIT)
  const bWidth = b.get(EMAIL_IMAGE_WIDTH_TRAIT)

  a.addAttributes({
    src: bAttrs.src || '',
    alt: bAttrs.alt || aAttrs.alt || ''
  })
  b.addAttributes({
    src: aAttrs.src || '',
    alt: aAttrs.alt || bAttrs.alt || ''
  })
  a.addStyle?.(bStyle)
  b.addStyle?.(aStyle)
  if (a.set) a.set(EMAIL_IMAGE_WIDTH_TRAIT, bWidth ?? EMAIL_IMAGE_WIDTH_DEFAULT_PCT)
  if (b.set) b.set(EMAIL_IMAGE_WIDTH_TRAIT, aWidth ?? EMAIL_IMAGE_WIDTH_DEFAULT_PCT)
}

function insideImageRow(component: GrapesComponent): boolean {
  return Boolean(findGrapesAncestorWithAttr(component, EMAIL_IMAGE_ROW_ATTR))
}

/**
 * Grapes often inserts the new Image as the previous/next block (above/below),
 * not as a sibling of the existing <img>. Walk ancestors and grab a neighbor
 * that already holds a photo, then merge into one row.
 */
function findNeighborImageViaAncestors(component: GrapesComponent): {
  partner: GrapesComponent
  side: 'left' | 'right'
} | null {
  let node: GrapesComponent | undefined = component
  for (let depth = 0; depth < 8 && node; depth += 1) {
    const parent = node.parent()
    if (!parent) break
    const collection = parent.components()
    const index = collection.indexOf(node)
    if (index < 0) {
      node = parent
      continue
    }

    for (const offset of [1, -1] as const) {
      const sibling = collection.at(index + offset)
      if (!sibling || sibling === component) continue
      if (isGrapesImageComponent(sibling)) {
        return { partner: sibling, side: offset > 0 ? 'left' : 'right' }
      }
      const nested = sibling.find('img').find((img) => isGrapesImageComponent(img) && img !== component)
      if (nested) {
        return { partner: nested, side: offset > 0 ? 'left' : 'right' }
      }
    }
    node = parent
  }
  return null
}

/**
 * If an image lands beside another image outside a row, wrap them in an
 * email-safe image-row table so they render side by side in clients.
 */
export function wrapAdjacentImages(component: GrapesComponent): void {
  if (!isGrapesImageComponent(component) || insideImageRow(component)) return
  const parent = component.parent()
  if (!parent) return
  if (Object.prototype.hasOwnProperty.call(parent.getAttributes() || {}, EMAIL_IMAGE_ROW_ATTR)) return
  if (Object.prototype.hasOwnProperty.call(parent.getAttributes() || {}, EMAIL_IMAGE_ROW_CELL_ATTR)) {
    return
  }

  const siblings = collectSiblingImages(parent)
  if (siblings.length >= 2) {
    const count = Math.min(4, siblings.length) as EmailImageRowCount
    const group = siblings.slice(0, count)
    const firstIndex = parent.components().indexOf(group[0]!)
    if (firstIndex < 0) return

    const html = emailImageRowHtml({
      count,
      srcs: group.map(imageSrc),
      spacingPx: EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
      align: 'center',
      valign: 'top'
    })

    for (let i = group.length - 1; i >= 0; i -= 1) {
      group[i]!.remove()
    }
    parent.append?.(html, { at: firstIndex })
    return
  }

  const neighbor = findNeighborImageViaAncestors(component)
  if (!neighbor) return
  mergeEmailImagesSideBySide(component, neighbor.partner, neighbor.side)
}

/**
 * When an image is dropped into a cell that already has another image,
 * swap/move so each cell keeps one photo and order updates in the same row.
 */
export function rearrangeImageInRow(component: GrapesComponent): void {
  if (!isGrapesImageComponent(component)) return
  const cell = findGrapesAncestorWithAttr(component, EMAIL_IMAGE_ROW_CELL_ATTR)
  if (!cell) return
  const row = findGrapesAncestorWithAttr(cell, EMAIL_IMAGE_ROW_ATTR)
  if (!row) return

  const imagesHere = listImagesInCell(cell).filter(Boolean)
  if (imagesHere.length <= 1) return

  const other = imagesHere.find((img) => img !== component)
  if (!other) return

  const cells = row.find(`[${EMAIL_IMAGE_ROW_CELL_ATTR}]`)
  const underfilled = cells.find((candidate) => {
    if (candidate === cell) return false
    return listImagesInCell(candidate).length === 0
  })
  if (underfilled?.append) {
    other.remove()
    underfilled.append(other)
    return
  }

  swapImagePayload(component, other)
  for (const extra of imagesHere) {
    if (extra === component || extra === other) continue
    extra.remove()
  }
}

export function onGrapesEmailImagePlacement(component: GrapesComponent | undefined): void {
  if (!component) return
  if (isGrapesEmailImageRowMerging()) return
  if (applyPendingEmailImageBeside(component)) return
  rearrangeImageInRow(component)
  wrapAdjacentImages(component)
}
