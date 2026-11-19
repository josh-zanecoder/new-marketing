import {
  EMAIL_IMAGE_ROW_ALIGN,
  EMAIL_IMAGE_ROW_ATTR,
  EMAIL_IMAGE_ROW_CELL_ATTR,
  EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
  EMAIL_IMAGE_ROW_SPACING_MAX_PX,
  EMAIL_IMAGE_ROW_SPACING_MIN_PX,
  EMAIL_IMAGE_ROW_TRAIT,
  EMAIL_IMAGE_ROW_VALIGN,
  type EmailImageRowAlign,
  type EmailImageRowVAlign
} from '../constants/emailImageRow'
import { readGrapesAttr, type GrapesComponent, type GrapesEditor } from './grapesEmailImageRowTypes'

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

function readRowSpacing(row: GrapesComponent): number {
  const fromProp = Number(row.get(EMAIL_IMAGE_ROW_TRAIT.spacing))
  const fromAttr = Number(readGrapesAttr(row, 'data-email-image-spacing'))
  const raw = Number.isFinite(fromProp) ? fromProp : fromAttr
  if (!Number.isFinite(raw)) return EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX
  return Math.max(
    EMAIL_IMAGE_ROW_SPACING_MIN_PX,
    Math.min(EMAIL_IMAGE_ROW_SPACING_MAX_PX, Math.round(raw))
  )
}

function readRowAlign(row: GrapesComponent): EmailImageRowAlign {
  const fromProp = String(row.get(EMAIL_IMAGE_ROW_TRAIT.align) || '')
  const fromAttr = readGrapesAttr(row, 'data-email-image-align')
  const value = fromProp || fromAttr
  return (EMAIL_IMAGE_ROW_ALIGN as readonly string[]).includes(value)
    ? (value as EmailImageRowAlign)
    : 'center'
}

function readRowValign(row: GrapesComponent): EmailImageRowVAlign {
  const fromProp = String(row.get(EMAIL_IMAGE_ROW_TRAIT.valign) || '')
  const fromAttr = readGrapesAttr(row, 'data-email-image-valign')
  const value = fromProp || fromAttr
  return (EMAIL_IMAGE_ROW_VALIGN as readonly string[]).includes(value)
    ? (value as EmailImageRowVAlign)
    : 'top'
}

export function applyEmailImageRowTraits(row: GrapesComponent): void {
  const spacingPx = readRowSpacing(row)
  const align = readRowAlign(row)
  const valign = readRowValign(row)
  row.addAttributes({
    'data-email-image-spacing': String(spacingPx),
    'data-email-image-align': align,
    'data-email-image-valign': valign
  })
  for (const cell of row.find(`[${EMAIL_IMAGE_ROW_CELL_ATTR}]`)) {
    setCellLayout(cell, spacingPx, align, valign)
  }
}

/** Register the email-image-row table type + spacing/align traits. */
export function registerGrapesEmailImageRowComponent(editor: GrapesEditor): void {
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
        droppable: `[${EMAIL_IMAGE_ROW_CELL_ATTR}], tbody, tr, td`,
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
        [EMAIL_IMAGE_ROW_TRAIT.spacing]: EMAIL_IMAGE_ROW_SPACING_DEFAULT_PX,
        [EMAIL_IMAGE_ROW_TRAIT.align]: 'center',
        [EMAIL_IMAGE_ROW_TRAIT.valign]: 'top',
        traits: [
          {
            type: 'number',
            name: EMAIL_IMAGE_ROW_TRAIT.spacing,
            label: 'Image spacing (px)',
            min: EMAIL_IMAGE_ROW_SPACING_MIN_PX,
            max: EMAIL_IMAGE_ROW_SPACING_MAX_PX,
            changeProp: 1
          },
          {
            type: 'select',
            name: EMAIL_IMAGE_ROW_TRAIT.align,
            label: 'Image align',
            options: EMAIL_IMAGE_ROW_ALIGN.map((value) => ({ id: value, label: value })),
            changeProp: 1
          },
          {
            type: 'select',
            name: EMAIL_IMAGE_ROW_TRAIT.valign,
            label: 'Vertical align',
            options: EMAIL_IMAGE_ROW_VALIGN.map((value) => ({ id: value, label: value })),
            changeProp: 1
          }
        ]
      },
      init(this: GrapesComponent) {
        const syncFromAttrs = () => {
          const spacing = Number(readGrapesAttr(this, 'data-email-image-spacing'))
          const align = readGrapesAttr(this, 'data-email-image-align')
          const valign = readGrapesAttr(this, 'data-email-image-valign')
          if (Number.isFinite(spacing)) this.set?.(EMAIL_IMAGE_ROW_TRAIT.spacing, spacing)
          if ((EMAIL_IMAGE_ROW_ALIGN as readonly string[]).includes(align)) {
            this.set?.(EMAIL_IMAGE_ROW_TRAIT.align, align)
          }
          if ((EMAIL_IMAGE_ROW_VALIGN as readonly string[]).includes(valign)) {
            this.set?.(EMAIL_IMAGE_ROW_TRAIT.valign, valign)
          }
          applyEmailImageRowTraits(this)
        }
        syncFromAttrs()
        this.on?.(`change:${EMAIL_IMAGE_ROW_TRAIT.spacing}`, () => applyEmailImageRowTraits(this))
        this.on?.(`change:${EMAIL_IMAGE_ROW_TRAIT.align}`, () => applyEmailImageRowTraits(this))
        this.on?.(`change:${EMAIL_IMAGE_ROW_TRAIT.valign}`, () => applyEmailImageRowTraits(this))
        this.on?.('change:attributes', () => applyEmailImageRowTraits(this))
      }
    }
  })
}
