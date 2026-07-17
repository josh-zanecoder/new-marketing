import { mergeAttributes, ResizableNodeView, type ResizableNodeViewDirection } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import { createCustomMarketingNodeDeleteButton } from './customMarketingEditorDeleteControl'

/** Corner grips only — aspect ratio stays locked while resizing from any corner. */
export const CUSTOM_MARKETING_IMAGE_RESIZE_DIRECTIONS: ResizableNodeViewDirection[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
]

export type CustomMarketingImageAlign = 'left' | 'center' | 'right'

export function normalizeCustomMarketingImageAlign(
  value: unknown
): CustomMarketingImageAlign {
  if (value === 'center' || value === 'right' || value === 'left') return value
  return 'left'
}

/** Gmail-safe placement: left/right float so following text wraps beside the photo. */
export function customMarketingImageAlignCss(align: CustomMarketingImageAlign): string {
  if (align === 'center') {
    return 'display:block;float:none;clear:both;margin-left:auto;margin-right:auto;'
  }
  if (align === 'right') {
    return 'display:block;float:right;margin:0 0 8px 12px;max-width:100%;height:auto;'
  }
  return 'display:block;float:left;margin:0 12px 8px 0;max-width:100%;height:auto;'
}

export function parseCustomMarketingImageAlign(element: HTMLElement): CustomMarketingImageAlign {
  const style = element.getAttribute('style') ?? ''
  if (/float\s*:\s*right/i.test(style)) return 'right'
  if (/float\s*:\s*left/i.test(style)) return 'left'
  const textAlign = element.style.textAlign
  if (textAlign === 'center' || textAlign === 'right' || textAlign === 'left') return textAlign
  const leftAuto = /margin-left\s*:\s*auto/i.test(style)
  const rightAuto = /margin-right\s*:\s*auto/i.test(style)
  if (leftAuto && rightAuto) return 'center'
  if (leftAuto) return 'right'
  return 'left'
}

function createCornerResizeHandle(direction: ResizableNodeViewDirection): HTMLElement {
  const handle = document.createElement('button')
  handle.type = 'button'
  handle.className = `custom-marketing-editor__image-handle custom-marketing-editor__image-handle--${direction}`
  handle.dataset.resizeHandle = direction
  handle.setAttribute('aria-label', `Drag ${direction} corner to resize`)
  handle.tabIndex = -1
  handle.draggable = false
  handle.addEventListener('dragstart', (event) => event.preventDefault())
  handle.style.position = 'absolute'
  if (direction.includes('top')) handle.style.top = '0'
  if (direction.includes('bottom')) handle.style.bottom = '0'
  if (direction.includes('left')) handle.style.left = '0'
  if (direction.includes('right')) handle.style.right = '0'
  return handle
}

/** TipTap uses display:flex for block images — shrink-wrap so grips sit on the photo, not the full editor width. */
export function fitCustomMarketingImageResizeDom(dom: HTMLElement): void {
  // block + fit-content lets margin auto center/right-align in the editor and in email HTML
  dom.style.display = 'block'
  dom.style.width = 'fit-content'
  dom.style.maxWidth = '100%'
  const wrap = dom.querySelector('.custom-marketing-editor__image-wrap')
  if (!(wrap instanceof HTMLElement)) return
  wrap.style.width = 'fit-content'
  wrap.style.maxWidth = '100%'
  wrap.style.lineHeight = '0'
}

export function applyCustomMarketingImageAlign(
  dom: HTMLElement,
  align: unknown
): void {
  const normalized = normalizeCustomMarketingImageAlign(align)
  dom.dataset.imageAlign = normalized
  // Float left/right so following paragraphs wrap beside the photo in the editor + email.
  if (normalized === 'center') {
    dom.style.float = 'none'
    dom.style.clear = 'both'
    dom.style.marginLeft = 'auto'
    dom.style.marginRight = 'auto'
    return
  }
  if (normalized === 'right') {
    dom.style.float = 'right'
    dom.style.clear = 'none'
    dom.style.marginLeft = '12px'
    dom.style.marginRight = '0'
    return
  }
  dom.style.float = 'left'
  dom.style.clear = 'none'
  dom.style.marginLeft = '0'
  dom.style.marginRight = '12px'
}

/** Shared by toolbar: image selection uses attrs; text uses TextAlign. */
export function customMarketingAlignCommandValue(
  align: 'left' | 'center' | 'right' | 'justify',
  imageSelected: boolean
):
  | { target: 'image'; align: CustomMarketingImageAlign }
  | { target: 'text'; align: 'left' | 'center' | 'right' | 'justify' } {
  if (!imageSelected) return { target: 'text', align }
  return { target: 'image', align: align === 'justify' ? 'left' : align }
}

/**
 * Block image: drag body to move in the document; toolbar align for left/center/right;
 * four corner grips to resize. Email HTML keeps a plain `<img>` with margin alignment.
 */
export const CustomMarketingDraggableImage = Image.extend({
  draggable: true,
  selectable: true,

  addOptions() {
    const parent = this.parent?.()
    return {
      inline: parent?.inline ?? false,
      allowBase64: parent?.allowBase64 ?? false,
      HTMLAttributes: parent?.HTMLAttributes ?? {},
      resize: {
        enabled: true as const,
        directions: [...CUSTOM_MARKETING_IMAGE_RESIZE_DIRECTIONS],
        minWidth: 96,
        minHeight: 96,
        alwaysPreserveAspectRatio: true as const
      }
    }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      textAlign: {
        default: 'left',
        parseHTML: (element) => parseCustomMarketingImageAlign(element),
        renderHTML: () => ({})
      }
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = HTMLAttributes.width
    const height = HTMLAttributes.height
    const widthPx =
      typeof width === 'number'
        ? width
        : typeof width === 'string' && /^\d+(\.\d+)?$/.test(width)
          ? Number(width)
          : null
    const align = normalizeCustomMarketingImageAlign(node.attrs.textAlign)
    const sizeStyle =
      widthPx && widthPx > 0
        ? `width:${Math.round(widthPx)}px;max-width:100%;height:auto;`
        : 'max-width:100%;height:auto;'
    const style = `${customMarketingImageAlignCss(align)}${sizeStyle}`

    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style,
        ...(widthPx ? { width: String(Math.round(widthPx)) } : {}),
        ...(height != null && height !== '' ? { height: String(height) } : {})
      })
    ]
  },

  addNodeView() {
    const resize = this.options.resize
    if (!resize || !resize.enabled || typeof document === 'undefined') {
      return null
    }

    const { minWidth, minHeight, alwaysPreserveAspectRatio } = resize
    const directions = resize.directions?.length
      ? resize.directions
      : CUSTOM_MARKETING_IMAGE_RESIZE_DIRECTIONS

    return ({ node, getPos, HTMLAttributes, editor }) => {
      const el = document.createElement('img')
      el.draggable = false
      el.className = 'custom-marketing-editor__image'
      const mergedAttributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)
      Object.entries(mergedAttributes).forEach(([key, value]) => {
        if (value == null) return
        if (key === 'width' || key === 'height' || key === 'style' || key === 'textAlign') return
        el.setAttribute(key, String(value))
      })
      if (mergedAttributes.src != null) el.src = String(mergedAttributes.src)

      const nodeView = new ResizableNodeView({
        element: el,
        editor,
        node,
        getPos,
        onResize: (width, height) => {
          el.style.width = `${width}px`
          el.style.height = `${height}px`
        },
        onCommit: (width, height) => {
          const pos = getPos()
          if (pos === undefined) return
          // Persist width; keep height for aspect during edit, email uses height:auto.
          this.editor.chain().setNodeSelection(pos).updateAttributes(this.name, {
            width: Math.round(width),
            height: Math.round(height)
          }).run()
          el.style.height = 'auto'
        },
        onUpdate: (updatedNode) => {
          if (updatedNode.type !== node.type) return false
          const nextSrc = String(updatedNode.attrs.src ?? '')
          if (el.getAttribute('src') !== nextSrc) el.src = nextSrc
          const nextWidth = updatedNode.attrs.width
          if (typeof nextWidth === 'number' && nextWidth > 0) {
            el.style.width = `${nextWidth}px`
            el.style.height = 'auto'
          } else if (nextWidth == null) {
            el.style.width = ''
            el.style.height = 'auto'
          }
          const dom = nodeView.dom as HTMLElement
          applyCustomMarketingImageAlign(dom, updatedNode.attrs.textAlign)
          return true
        },
        options: {
          directions,
          min: {
            width: minWidth ?? 96,
            height: minHeight ?? 96
          },
          preserveAspectRatio: alwaysPreserveAspectRatio !== false,
          className: {
            container: 'custom-marketing-editor__image-resize',
            wrapper: 'custom-marketing-editor__image-wrap',
            handle: 'custom-marketing-editor__image-handle',
            resizing: 'is-resizing'
          },
          createCustomHandle: (direction) => createCornerResizeHandle(direction)
        }
      })

      const dom = nodeView.dom as HTMLElement
      fitCustomMarketingImageResizeDom(dom)
      applyCustomMarketingImageAlign(dom, node.attrs.textAlign)
      dom.setAttribute('data-drag-handle', '')
      dom.draggable = true
      dom.contentEditable = 'false'
      const deleteButton = createCustomMarketingNodeDeleteButton({
        ariaLabel: 'Remove photo',
        title: 'Remove photo',
        onDelete: () => {
          const pos = getPos()
          if (typeof pos !== 'number') return
          editor.chain().focus().setNodeSelection(pos).deleteSelection().run()
        }
      })
      dom.appendChild(deleteButton)
      dom.style.visibility = 'hidden'
      dom.style.pointerEvents = 'none'
      el.onload = () => {
        dom.style.visibility = ''
        dom.style.pointerEvents = ''
        el.style.height = 'auto'
      }
      if (el.complete) {
        dom.style.visibility = ''
        dom.style.pointerEvents = ''
        el.style.height = 'auto'
      }

      return nodeView
    }
  }
})
