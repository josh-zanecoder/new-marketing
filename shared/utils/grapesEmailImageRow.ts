/**
 * GrapesJS wiring for side-by-side email images.
 * Shared by the iframe builder and the in-app email-editor Grapes mode.
 */
import {
  EMAIL_IMAGE_ROW_ALIGN,
  EMAIL_IMAGE_ROW_ATTR,
  EMAIL_IMAGE_ROW_BLOCK_CATEGORY,
  EMAIL_IMAGE_ROW_BLOCK_IDS,
  EMAIL_IMAGE_ROW_BLOCK_LABELS,
  EMAIL_IMAGE_ROW_CELL_ATTR,
  EMAIL_IMAGE_ROW_COUNTS,
  EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
  EMAIL_IMAGE_ROW_SPACING_MAX_PX,
  EMAIL_IMAGE_ROW_SPACING_MIN_PX,
  EMAIL_IMAGE_ROW_VALIGN,
  type EmailImageRowAlign,
  type EmailImageRowCount,
  type EmailImageRowVAlign
} from '../constants/emailImageRow'
import { emailImageRowHtml } from './emailImageRow'

type GrapesComponent = {
  get: (key: string) => unknown
  getAttributes: () => Record<string, string>
  addAttributes: (attrs: Record<string, string>) => void
  addStyle?: (style: Record<string, string>) => void
  parent: () => GrapesComponent | undefined
  components: {
    (): { models: GrapesComponent[]; length: number; at: (i: number) => GrapesComponent | undefined; indexOf: (c: GrapesComponent) => number }
    (content?: unknown, opts?: object): unknown
  }
  find: (selector: string) => GrapesComponent[]
  remove: (opts?: object) => void
  append?: (content: unknown, opts?: object) => GrapesComponent[]
  closest?: (query: string) => GrapesComponent | undefined
}

type GrapesEditor = {
  BlockManager: {
    add: (id: string, conf: Record<string, unknown>) => void
    get: (id: string) => { set: (conf: Record<string, unknown>) => void } | undefined
  }
  DomComponents: {
    addType: (id: string, conf: Record<string, unknown>) => void
  }
  on: (event: string, cb: (...args: unknown[]) => void) => void
}

const TWO_MEDIA =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h8v14H3V5zm10 0h8v14h-8V5zM2 4v16a1 1 0 001 1h8a1 1 0 001-1V4a1 1 0 00-1-1H3a1 1 0 00-1 1zm10 0v16a1 1 0 001 1h8a1 1 0 001-1V4a1 1 0 00-1-1h-8a1 1 0 00-1 1z"/></svg>'

const THREE_MEDIA =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 5h6v14H2V5zm8 0h4v14h-4V5zm6 0h6v14h-6V5z"/></svg>'

const FOUR_MEDIA =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 4h8v7H3V4zm10 0h8v7h-8V4zM3 13h8v7H3v-7zm10 0h8v7h-8v-7z"/></svg>'

function readAttr(component: GrapesComponent, name: string): string {
  return String(component.getAttributes()?.[name] ?? '')
}

function setCellLayout(
  cell: GrapesComponent,
  spacingPx: number,
  align: EmailImageRowAlign,
  valign: EmailImageRowVAlign
) {
  cell.addAttributes({
    align,
    valign,
    [EMAIL_IMAGE_ROW_CELL_ATTR]: ''
  })
  cell.addStyle?.({
    padding: `${spacingPx}px`,
    'vertical-align': valign,
    'text-align': align
  })
}

function applyRowTraits(row: GrapesComponent) {
  const spacingRaw = Number(readAttr(row, 'data-email-image-spacing'))
  const spacingPx = Number.isFinite(spacingRaw)
    ? Math.max(EMAIL_IMAGE_ROW_SPACING_MIN_PX, Math.min(EMAIL_IMAGE_ROW_SPACING_MAX_PX, Math.round(spacingRaw)))
    : EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX
  const align = (EMAIL_IMAGE_ROW_ALIGN as readonly string[]).includes(readAttr(row, 'data-email-image-align'))
    ? (readAttr(row, 'data-email-image-align') as EmailImageRowAlign)
    : 'center'
  const valign = (EMAIL_IMAGE_ROW_VALIGN as readonly string[]).includes(readAttr(row, 'data-email-image-valign'))
    ? (readAttr(row, 'data-email-image-valign') as EmailImageRowVAlign)
    : 'top'
  for (const cell of row.find(`[${EMAIL_IMAGE_ROW_CELL_ATTR}]`)) {
    setCellLayout(cell, spacingPx, align, valign)
  }
}

function isImageComponent(component: GrapesComponent | undefined): boolean {
  return component?.get('type') === 'image'
}

function insideImageRow(component: GrapesComponent): boolean {
  let node: GrapesComponent | undefined = component
  while (node) {
    if (readAttr(node, EMAIL_IMAGE_ROW_ATTR)) return true
    node = node.parent?.()
  }
  return false
}

/**
 * If an image lands beside another image outside a row, wrap them in an
 * email-safe image-row table so they render side by side in clients.
 */
function wrapAdjacentImages(component: GrapesComponent) {
  if (!isImageComponent(component) || insideImageRow(component)) return
  const parent = component.parent()
  if (!parent) return
  if (readAttr(parent, EMAIL_IMAGE_ROW_ATTR) || readAttr(parent, EMAIL_IMAGE_ROW_CELL_ATTR)) return

  const collection = parent.components()
  const index = collection.indexOf(component)
  if (index < 0) return
  const prev = collection.at(index - 1)
  const next = collection.at(index + 1)
  const partner = isImageComponent(prev) ? prev : isImageComponent(next) ? next : undefined
  if (!partner) return

  const firstIndex = Math.min(collection.indexOf(partner), index)
  const secondIndex = Math.max(collection.indexOf(partner), index)
  const first = collection.at(firstIndex)
  const second = collection.at(secondIndex)
  if (!first || !second) return

  const firstSrc = String((first.getAttributes() as { src?: string }).src || '')
  const secondSrc = String((second.getAttributes() as { src?: string }).src || '')
  const html = emailImageRowHtml({
    count: 2,
    srcs: [firstSrc, secondSrc],
    spacingPx: EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
    align: 'center',
    valign: 'top'
  })

  // Remove higher index first so the lower insert slot stays stable.
  second.remove()
  first.remove()
  parent.append?.(html, { at: firstIndex })
}

function registerImageRowComponent(editor: GrapesEditor) {
  editor.DomComponents.addType('email-image-row', {
    isComponent(el: HTMLElement) {
      if (el?.getAttribute?.(EMAIL_IMAGE_ROW_ATTR) != null) {
        return { type: 'email-image-row' }
      }
      return false
    },
    model: {
      defaults: {
        tagName: 'table',
        droppable: 'tbody, tr, [data-email-image-cell]',
        attributes: {
          [EMAIL_IMAGE_ROW_ATTR]: '2',
          'data-email-image-spacing': String(EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX),
          'data-email-image-align': 'center',
          'data-email-image-valign': 'top',
          role: 'presentation',
          width: '100%',
          cellpadding: '0',
          cellspacing: '0',
          border: '0'
        },
        styles: 'width:100%;border-collapse:collapse;table-layout:fixed;',
        traits: [
          {
            type: 'number',
            name: 'data-email-image-spacing',
            label: 'Image spacing (px)',
            min: EMAIL_IMAGE_ROW_SPACING_MIN_PX,
            max: EMAIL_IMAGE_ROW_SPACING_MAX_PX,
            changeProp: 1
          },
          {
            type: 'select',
            name: 'data-email-image-align',
            label: 'Image align',
            options: EMAIL_IMAGE_ROW_ALIGN.map((value) => ({ id: value, label: value })),
            changeProp: 1
          },
          {
            type: 'select',
            name: 'data-email-image-valign',
            label: 'Vertical align',
            options: EMAIL_IMAGE_ROW_VALIGN.map((value) => ({ id: value, label: value })),
            changeProp: 1
          }
        ]
      },
      init(this: GrapesComponent & { on: (ev: string, cb: () => void) => void }) {
        this.on('change:attributes:data-email-image-spacing', () => applyRowTraits(this))
        this.on('change:attributes:data-email-image-align', () => applyRowTraits(this))
        this.on('change:attributes:data-email-image-valign', () => applyRowTraits(this))
      }
    }
  })
}

function registerBlocks(editor: GrapesEditor, placeholderSrc?: string) {
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

function hardenSingleImageBlock(editor: GrapesEditor, placeholderSrc?: string) {
  const imageBlock = editor.BlockManager.get('image')
  if (!imageBlock) return
  imageBlock.set({
    activate: false,
    select: true,
    content: {
      type: 'image',
      attributes: { src: placeholderSrc || '', alt: 'Image' },
      style: { display: 'block', width: '100%', height: 'auto', 'max-width': '100%' }
    }
  })
}

function enableIndependentImageResize(editor: GrapesEditor) {
  editor.DomComponents.addType('image', {
    extend: 'image',
    model: {
      defaults: {
        resizable: {
          tl: 1,
          tc: 0,
          tr: 1,
          cl: 1,
          cr: 1,
          bl: 1,
          bc: 0,
          br: 1,
          ratioDefault: true
        },
        traits: [
          'alt',
          'title',
          {
            type: 'number',
            label: 'Width %',
            name: 'emailWidthPct',
            placeholder: '100',
            min: 10,
            max: 100,
            changeProp: 1
          }
        ]
      },
      init(this: GrapesComponent & { on: (ev: string, cb: () => void) => void; addStyle: (s: Record<string, string>) => void }) {
        this.on('change:emailWidthPct', () => {
          const width = Number(this.get('emailWidthPct'))
          if (!Number.isFinite(width) || width <= 0) return
          const clamped = Math.max(10, Math.min(100, Math.round(width)))
          this.addStyle({
            width: `${clamped}%`,
            'max-width': '100%',
            height: 'auto',
            display: 'block'
          })
        })
      }
    }
  })
}

/** Register side-by-side image blocks, traits, resize, and auto-wrap on drag. */
export function setupGrapesEmailImageRow(
  editor: GrapesEditor,
  options?: { placeholderSrc?: string }
): void {
  const placeholderSrc = options?.placeholderSrc
  registerImageRowComponent(editor)
  enableIndependentImageResize(editor)
  registerBlocks(editor, placeholderSrc)
  hardenSingleImageBlock(editor, placeholderSrc)

  editor.on('component:drag:end', (...args: unknown[]) => {
    const payload = args[0] as { target?: GrapesComponent } | GrapesComponent | undefined
    const component = payload && typeof payload === 'object' && 'target' in payload
      ? payload.target
      : (payload as GrapesComponent | undefined)
    if (component) wrapAdjacentImages(component)
  })
}

export function emailImageRowBlockIds(): string[] {
  return EMAIL_IMAGE_ROW_COUNTS.map((count) => {
    if (count === 2) return EMAIL_IMAGE_ROW_BLOCK_IDS.two
    if (count === 3) return EMAIL_IMAGE_ROW_BLOCK_IDS.three
    return EMAIL_IMAGE_ROW_BLOCK_IDS.four
  })
}
