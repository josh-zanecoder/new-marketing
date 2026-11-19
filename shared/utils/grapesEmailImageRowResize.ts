import {
  EMAIL_IMAGE_WIDTH_DEFAULT_PCT,
  EMAIL_IMAGE_WIDTH_MAX_PCT,
  EMAIL_IMAGE_WIDTH_MIN_PCT,
  EMAIL_IMAGE_WIDTH_TRAIT
} from '../constants/emailImageRow'
import {
  clampEmailImageWidthPct,
  emailImageIndependentWidthStyle,
  pxWidthToCellPercent
} from './emailImageRowWidth'
import {
  isGrapesImageComponent,
  resolveGrapesEventComponent,
  type GrapesComponent,
  type GrapesEditor
} from './grapesEmailImageRowTypes'

function applyWidthPctToImage(component: GrapesComponent, widthPct: unknown) {
  const clamped = clampEmailImageWidthPct(widthPct)
  component.set?.(EMAIL_IMAGE_WIDTH_TRAIT, clamped)
  component.addStyle?.(emailImageIndependentWidthStyle(clamped))
  component.addAttributes({ width: `${clamped}%` })
}

/**
 * Independent per-image resize. Extends image defaults without replacing host view hooks
 * (file picker / onLoad guards stay from setupSafeImages / stopImageLoadLoop).
 */
export function enableGrapesIndependentImageResize(editor: GrapesEditor): void {
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
          ratioDefault: true,
          unitWidth: 'px'
        },
        [EMAIL_IMAGE_WIDTH_TRAIT]: EMAIL_IMAGE_WIDTH_DEFAULT_PCT,
        traits: [
          'alt',
          'title',
          {
            type: 'number',
            label: 'Width %',
            name: EMAIL_IMAGE_WIDTH_TRAIT,
            placeholder: String(EMAIL_IMAGE_WIDTH_DEFAULT_PCT),
            min: EMAIL_IMAGE_WIDTH_MIN_PCT,
            max: EMAIL_IMAGE_WIDTH_MAX_PCT,
            changeProp: 1
          }
        ]
      },
      init(this: GrapesComponent) {
        this.on?.(`change:${EMAIL_IMAGE_WIDTH_TRAIT}`, () => {
          applyWidthPctToImage(this, this.get(EMAIL_IMAGE_WIDTH_TRAIT))
        })
      }
    }
  })

  editor.on('component:resize:end', (...args: unknown[]) => {
    const component = resolveGrapesEventComponent(args)
    if (!component || !isGrapesImageComponent(component)) return
    const style = component.getStyle?.() || {}
    const widthRaw = String(style.width || '')
    const px = /^(\d+(?:\.\d+)?)px$/i.exec(widthRaw)?.[1]
    if (!px) {
      const pct = clampEmailImageWidthPct(
        component.get(EMAIL_IMAGE_WIDTH_TRAIT) || widthRaw.replace('%', '')
      )
      applyWidthPctToImage(component, pct)
      return
    }
    const el = component.getEl?.()
    const parentEl = el?.parentElement
    const cellWidth = parentEl?.clientWidth || 0
    const pct = pxWidthToCellPercent(Number(px), cellWidth)
    applyWidthPctToImage(component, pct)
  })
}
