/**
 * Beside-drop UX for Grapes: hovering any image while dragging Image means
 * side-by-side (2→3→4). Tracks pointer on the parent page because BlockManager
 * drag starts outside the canvas iframe.
 */
import {
  EMAIL_IMAGE_BESIDE_BODY_CLASS,
  EMAIL_IMAGE_BESIDE_HINT_ATTR,
  EMAIL_IMAGE_BESIDE_HINT_LABEL,
  EMAIL_IMAGE_BESIDE_ZONE_RATIO,
  EMAIL_IMAGE_ROW_ATTR,
  EMAIL_IMAGE_ROW_CELL_ATTR,
  EMAIL_IMAGE_ROW_COUNTS,
  EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX
} from '../constants/emailImageRow'
import {
  findEmailImageBesideHit,
  findEmailImageBesidePartnerAfterStack,
  mapParentPointToFrame,
  type EmailImageBesideHitRect
} from './emailImageBesideHit'
import type { EmailImageBesideSide } from './emailImageBesideZone'
import { emailImageRowHtml } from './emailImageRow'
import {
  buildTwoImageRowSrcs,
  insertSrcBesideInEmailImageRow
} from './emailImageRowInsert'
import {
  findGrapesAncestorWithAttr,
  isGrapesImageComponent,
  type GrapesComponent,
  type GrapesEditor
} from './grapesEmailImageRowTypes'

export type EmailImageBesideIntent = {
  partner: GrapesComponent
  side: EmailImageBesideSide
}

type CanvasApi = {
  getDocument?: () => Document | undefined
  getBody?: () => HTMLElement | undefined
  getFrameEl?: () => HTMLIFrameElement | undefined
}

type EditorWithCanvas = GrapesEditor & {
  Canvas?: CanvasApi
  getWrapper?: () => GrapesComponent | undefined
}

const HINT_STYLE_ID = 'email-image-beside-hint-style'
const MAX_ROW_IMAGES = EMAIL_IMAGE_ROW_COUNTS[EMAIL_IMAGE_ROW_COUNTS.length - 1]!

let pendingBeside: EmailImageBesideIntent | null = null
let draggingBlock = false
let lastFramePointer: { x: number; y: number } | null = null
let activeEditor: EditorWithCanvas | null = null
/** Suppress nested component:add while we rewrite a row. */
let mergingRow = false

export function getPendingEmailImageBesideIntent(): EmailImageBesideIntent | null {
  return pendingBeside
}

export function clearPendingEmailImageBesideIntent(): void {
  pendingBeside = null
}

export function isGrapesEmailImageRowMerging(): boolean {
  return mergingRow
}

function ensureHintStyles(doc: Document) {
  if (doc.getElementById(HINT_STYLE_ID)) return
  const style = doc.createElement('style')
  style.id = HINT_STYLE_ID
  style.textContent = `
    body.${EMAIL_IMAGE_BESIDE_BODY_CLASS} .gjs-placeholder,
    body.${EMAIL_IMAGE_BESIDE_BODY_CLASS} .gjs-placeholder-int,
    body.${EMAIL_IMAGE_BESIDE_BODY_CLASS} .gjs-highlighter,
    body.${EMAIL_IMAGE_BESIDE_BODY_CLASS} .gjs-highlighter-warning {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    [${EMAIL_IMAGE_BESIDE_HINT_ATTR}] {
      position: fixed;
      z-index: 2147483646;
      box-sizing: border-box;
      min-width: 72px;
      border: 2px dashed #16a34a;
      background: rgba(22, 163, 74, 0.14);
      color: #15803d;
      font: 600 12px Arial, Helvetica, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none !important;
      border-radius: 4px;
    }
  `
  doc.head.appendChild(style)
}

function clearBesideHint(doc: Document | undefined) {
  if (!doc) return
  doc.body?.classList.remove(EMAIL_IMAGE_BESIDE_BODY_CLASS)
  doc.querySelectorAll(`[${EMAIL_IMAGE_BESIDE_HINT_ATTR}]`).forEach((el) => el.remove())
}

function showBesideHint(
  doc: Document,
  el: HTMLElement,
  side: EmailImageBesideSide,
  label: string
) {
  ensureHintStyles(doc)
  clearBesideHint(doc)
  doc.body.classList.add(EMAIL_IMAGE_BESIDE_BODY_CLASS)

  const rect = el.getBoundingClientRect()
  const hint = doc.createElement('div')
  hint.setAttribute(EMAIL_IMAGE_BESIDE_HINT_ATTR, side)
  hint.textContent = label
  const half = Math.max(rect.width * Math.min(EMAIL_IMAGE_BESIDE_ZONE_RATIO, 0.5), 72)
  hint.style.top = `${rect.top}px`
  hint.style.height = `${Math.max(rect.height, 40)}px`
  if (side === 'left') {
    hint.style.left = `${rect.left}px`
    hint.style.width = `${half}px`
  } else {
    hint.style.left = `${rect.right - half}px`
    hint.style.width = `${half}px`
  }
  doc.body.appendChild(hint)
}

function imageSrc(component: GrapesComponent): string {
  return String((component.getAttributes() as { src?: string }).src || '')
}

function componentKey(component: GrapesComponent): string {
  return String(component.get('cid') || component.get('id') || imageSrc(component) || Math.random())
}

function listImagesInRow(row: GrapesComponent): GrapesComponent[] {
  const cells = row.find(`[${EMAIL_IMAGE_ROW_CELL_ATTR}]`)
  if (!cells.length) {
    return row.find('img').filter((node) => isGrapesImageComponent(node))
  }
  const images: GrapesComponent[] = []
  for (const cell of cells) {
    const inCell = cell.find('img').filter((node) => isGrapesImageComponent(node))
    if (inCell[0]) images.push(inCell[0])
  }
  return images
}

function rowImageCount(component: GrapesComponent): number {
  const row = findGrapesAncestorWithAttr(component, EMAIL_IMAGE_ROW_ATTR)
  if (!row) return 1
  return Math.max(1, listImagesInRow(row).length)
}

function listImageTargets(editor: EditorWithCanvas): Array<{
  component: GrapesComponent
  el: HTMLElement
  rect: EmailImageBesideHitRect
}> {
  const wrapper = editor.getWrapper?.()
  if (!wrapper) return []
  const out: Array<{
    component: GrapesComponent
    el: HTMLElement
    rect: EmailImageBesideHitRect
  }> = []
  for (const component of wrapper.find('img')) {
    if (!isGrapesImageComponent(component)) continue
    const inRow = Boolean(findGrapesAncestorWithAttr(component, EMAIL_IMAGE_ROW_ATTR))
    if (inRow && rowImageCount(component) >= MAX_ROW_IMAGES) continue
    const el = component.getEl?.()
    if (!el) continue
    const box = el.getBoundingClientRect()
    out.push({
      component,
      el,
      rect: {
        id: componentKey(component),
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height
      }
    })
  }
  return out
}

function updateBesideFromFramePointer(editor: EditorWithCanvas, frameX: number, frameY: number) {
  const doc = editor.Canvas?.getDocument?.()
  if (!doc) return
  // Never leave a sticky overlay when the user is not actively dragging.
  if (!draggingBlock) {
    clearBesideHint(doc)
    return
  }
  lastFramePointer = { x: frameX, y: frameY }

  const targets = listImageTargets(editor)
  const hit = findEmailImageBesideHit(
    frameX,
    frameY,
    targets.map((t) => t.rect)
  )
  if (!hit) {
    pendingBeside = null
    clearBesideHint(doc)
    return
  }
  const match = targets.find((t) => t.rect.id === hit.id)
  if (!match) {
    pendingBeside = null
    clearBesideHint(doc)
    return
  }
  pendingBeside = { partner: match.component, side: hit.side }
  // One label only — "Add to row" was sticking on screen after drop.
  showBesideHint(doc, match.el, hit.side, EMAIL_IMAGE_BESIDE_HINT_LABEL)
}

function parentPointToFrame(editor: EditorWithCanvas, parentX: number, parentY: number): {
  x: number
  y: number
} | null {
  const frame = editor.Canvas?.getFrameEl?.()
  if (!frame) return { x: parentX, y: parentY }
  return mapParentPointToFrame(parentX, parentY, frame.getBoundingClientRect())
}

function readRowLayout(row: GrapesComponent): {
  spacingPx: number
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle' | 'bottom'
} {
  const attrs = row.getAttributes() || {}
  const spacingRaw = Number(attrs['data-email-image-spacing'])
  const spacingPx = Number.isFinite(spacingRaw)
    ? spacingRaw
    : EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX
  const alignRaw = String(attrs['data-email-image-align'] || 'center')
  const valignRaw = String(attrs['data-email-image-valign'] || 'top')
  const align = (['left', 'center', 'right'] as const).includes(alignRaw as 'left')
    ? (alignRaw as 'left' | 'center' | 'right')
    : 'center'
  const valign = (['top', 'middle', 'bottom'] as const).includes(valignRaw as 'top')
    ? (valignRaw as 'top' | 'middle' | 'bottom')
    : 'top'
  return { spacingPx, align, valign }
}

function resolveIntent(
  dropped: GrapesComponent,
  intent: EmailImageBesideIntent | null
): EmailImageBesideIntent | null {
  if (intent && intent.partner !== dropped && isGrapesImageComponent(intent.partner)) {
    return intent
  }
  if (!activeEditor) return null

  const targets = listImageTargets(activeEditor).filter((t) => t.component !== dropped)
  if (!targets.length) return null

  const droppedEl = dropped.getEl?.()
  const droppedBox = droppedEl?.getBoundingClientRect()
  // Layout may not be ready yet — caller retries.
  if (!droppedBox || droppedBox.width < 2 || droppedBox.height < 2) return null

  const droppedRect: EmailImageBesideHitRect = {
    id: componentKey(dropped),
    left: droppedBox.left,
    top: droppedBox.top,
    width: droppedBox.width,
    height: droppedBox.height
  }
  const others = targets.map((t) => t.rect)

  const hit =
    (lastFramePointer
      ? findEmailImageBesideHit(lastFramePointer.x, lastFramePointer.y, others)
      : null) ||
    findEmailImageBesidePartnerAfterStack({
      dropped: droppedRect,
      others,
      pointer: lastFramePointer
    })

  if (!hit) return null
  const match = targets.find((t) => t.rect.id === hit.id)
  if (!match) return null
  return { partner: match.component, side: hit.side }
}

/** Public merge used by DnD fallbacks when geometry/DOM finds a neighbor. */
export function mergeEmailImagesSideBySide(
  dropped: GrapesComponent,
  partner: GrapesComponent,
  side: EmailImageBesideSide
): boolean {
  return mergeDroppedWithPartner(dropped, partner, side)
}

function mergeDroppedWithPartner(
  dropped: GrapesComponent,
  partner: GrapesComponent,
  side: EmailImageBesideSide
): boolean {
  if (partner === dropped) return false
  if (findGrapesAncestorWithAttr(dropped, EMAIL_IMAGE_ROW_ATTR)) return false

  const droppedSrc = imageSrc(dropped)
  const existingRow = findGrapesAncestorWithAttr(partner, EMAIL_IMAGE_ROW_ATTR)

  mergingRow = true
  try {
    if (existingRow) {
      const images = listImagesInRow(existingRow)
      if (images.length >= MAX_ROW_IMAGES) return false
      const partnerIndex = images.indexOf(partner)
      if (partnerIndex < 0) return false
      const inserted = insertSrcBesideInEmailImageRow({
        existingSrcs: images.map(imageSrc),
        partnerIndex,
        newSrc: droppedSrc,
        side
      })
      if (!inserted) return false
      const layout = readRowLayout(existingRow)
      const html = emailImageRowHtml({
        count: inserted.count,
        srcs: inserted.srcs,
        spacingPx: layout.spacingPx,
        align: layout.align,
        valign: layout.valign
      })
      const rowParent = existingRow.parent()
      if (!rowParent?.append) return false
      const at = rowParent.components().indexOf(existingRow)
      if (at < 0) return false
      dropped.remove()
      existingRow.remove()
      rowParent.append(html, { at })
      return true
    }

    const srcs = buildTwoImageRowSrcs(imageSrc(partner), droppedSrc, side)
    const html = emailImageRowHtml({
      count: 2,
      srcs,
      spacingPx: EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
      align: 'center',
      valign: 'top'
    })
    const parent = partner.parent()
    if (!parent?.append) return false
    const at = parent.components().indexOf(partner)
    if (at < 0) return false
    const droppedParent = dropped.parent()
    const droppedIndex =
      droppedParent === parent ? parent.components().indexOf(dropped) : -1
    if (droppedIndex >= 0 && droppedIndex > at) {
      dropped.remove()
      partner.remove()
    } else {
      if (droppedParent) dropped.remove()
      partner.remove()
    }
    parent.append(html, { at: Math.min(at, Math.max(0, droppedIndex >= 0 ? droppedIndex : at)) })
    return true
  } finally {
    mergingRow = false
  }
}

/**
 * After Grapes inserts an image (often with the green "above" line), join it
 * into a horizontal row with the nearest stacked photo (2→3→4).
 * Does not clear pending intent until merge succeeds so retries still work.
 */
export function applyPendingEmailImageBeside(
  dropped: GrapesComponent | undefined
): boolean {
  if (mergingRow) return false
  if (!dropped || !isGrapesImageComponent(dropped)) return false
  if (findGrapesAncestorWithAttr(dropped, EMAIL_IMAGE_ROW_ATTR)) return false

  const intent = resolveIntent(dropped, pendingBeside)
  if (!intent) return false

  const ok = mergeDroppedWithPartner(dropped, intent.partner, intent.side)
  if (ok) {
    clearPendingEmailImageBesideIntent()
    lastFramePointer = null
    clearBesideHint(dropped.getEl?.()?.ownerDocument)
  }
  return ok
}

function bindPointerTracking(
  editor: EditorWithCanvas,
  onFrameMove: (x: number, y: number) => void
): () => void {
  const handleParent = (ev: MouseEvent) => {
    const mapped = parentPointToFrame(editor, ev.clientX, ev.clientY)
    if (!mapped) return
    onFrameMove(mapped.x, mapped.y)
  }
  document.addEventListener('mousemove', handleParent, true)
  document.addEventListener('dragover', handleParent as EventListener, true)
  window.addEventListener('mousemove', handleParent, true)

  const frameDoc = editor.Canvas?.getDocument?.()
  const handleFrame = (ev: MouseEvent) => onFrameMove(ev.clientX, ev.clientY)
  frameDoc?.addEventListener('mousemove', handleFrame, true)
  frameDoc?.addEventListener('dragover', handleFrame as EventListener, true)

  return () => {
    document.removeEventListener('mousemove', handleParent, true)
    document.removeEventListener('dragover', handleParent as EventListener, true)
    window.removeEventListener('mousemove', handleParent, true)
    frameDoc?.removeEventListener('mousemove', handleFrame, true)
    frameDoc?.removeEventListener('dragover', handleFrame as EventListener, true)
  }
}

/** Track pointer for any block drag — apply runs only when an image is added. */
export function setupGrapesEmailImageBesideDrop(editor: GrapesEditor): void {
  const ed = editor as EditorWithCanvas
  activeEditor = ed
  let stopTrack: (() => void) | null = null

  const startTrack = () => {
    stopTrack?.()
    stopTrack = bindPointerTracking(ed, (x, y) => {
      if (!draggingBlock) return
      updateBesideFromFramePointer(ed, x, y)
    })
  }

  const endTrack = () => {
    stopTrack?.()
    stopTrack = null
  }

  // Track every block drag so we never miss Image because of label/id quirks.
  editor.on('block:drag:start', () => {
    draggingBlock = true
    startTrack()
  })

  editor.on('block:drag', (...args: unknown[]) => {
    draggingBlock = true
    if (!stopTrack) startTrack()
    const ev = args[1] as MouseEvent | undefined
    if (ev && typeof ev.clientX === 'number') {
      const mapped = parentPointToFrame(ed, ev.clientX, ev.clientY)
      if (mapped) updateBesideFromFramePointer(ed, mapped.x, mapped.y)
    }
  })

  editor.on('block:drag:stop', () => {
    draggingBlock = false
    endTrack()
    // Always hide the overlay; keep pendingBeside for the post-drop merge.
    clearBesideHint(ed.Canvas?.getDocument?.())
  })

  editor.on('component:drag:start', (...args: unknown[]) => {
    const component = resolveDragComponent(args[0])
    draggingBlock = Boolean(component && isGrapesImageComponent(component))
    if (draggingBlock) startTrack()
  })

  editor.on('component:drag', (...args: unknown[]) => {
    const payload = args[0] as { target?: GrapesComponent } | GrapesComponent | undefined
    const target = resolveDragComponent(payload)
    if (!target || !isGrapesImageComponent(target)) return
    draggingBlock = true
    if (!stopTrack) startTrack()
  })

  editor.on('component:drag:end', () => {
    draggingBlock = false
    endTrack()
    clearBesideHint(ed.Canvas?.getDocument?.())
  })
}

function resolveDragComponent(
  payload: { target?: GrapesComponent } | GrapesComponent | undefined
): GrapesComponent | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  if ('target' in payload && payload.target) return payload.target
  if (typeof (payload as GrapesComponent).get === 'function') return payload as GrapesComponent
  return undefined
}
