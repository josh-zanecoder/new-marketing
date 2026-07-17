import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Window } from 'happy-dom'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import {
  CUSTOM_MARKETING_IMAGE_RESIZE_DIRECTIONS,
  CustomMarketingDraggableImage,
  applyCustomMarketingImageAlign,
  customMarketingAlignCommandValue,
  customMarketingImageAlignCss,
  fitCustomMarketingImageResizeDom,
  normalizeCustomMarketingImageAlign,
  parseCustomMarketingImageAlign
} from '../customMarketingDraggableImage'

function installDom(): void {
  const window = new Window({ url: 'https://localhost/' })
  const { document } = window
  Object.defineProperty(globalThis, 'window', { value: window, configurable: true })
  Object.defineProperty(globalThis, 'document', { value: document, configurable: true })
  Object.defineProperty(globalThis, 'HTMLElement', { value: window.HTMLElement, configurable: true })
  Object.defineProperty(globalThis, 'Element', { value: window.Element, configurable: true })
  Object.defineProperty(globalThis, 'Node', { value: window.Node, configurable: true })
  Object.defineProperty(globalThis, 'DocumentFragment', {
    value: window.DocumentFragment,
    configurable: true
  })
  Object.defineProperty(globalThis, 'MutationObserver', {
    value: window.MutationObserver,
    configurable: true
  })
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number,
    configurable: true
  })
}

installDom()

describe('customMarketingDraggableImage', () => {
  it('exposes four corner resize directions', () => {
    assert.deepEqual(CUSTOM_MARKETING_IMAGE_RESIZE_DIRECTIONS, [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right'
    ])
    const resize = CustomMarketingDraggableImage.options.resize
    if (resize === false) {
      assert.fail('expected resize options object')
      return
    }
    assert.ok(resize.enabled)
    assert.deepEqual(resize.directions, CUSTOM_MARKETING_IMAGE_RESIZE_DIRECTIONS)
  })

  it('shrink-wraps the resize container to the image', () => {
    const dom = document.createElement('div')
    dom.style.display = 'flex'
    const wrap = document.createElement('div')
    wrap.className = 'custom-marketing-editor__image-wrap'
    wrap.style.display = 'block'
    dom.appendChild(wrap)
    fitCustomMarketingImageResizeDom(dom)
    assert.equal(dom.style.display, 'block')
    assert.equal(dom.style.width, 'fit-content')
    assert.equal(wrap.style.width, 'fit-content')
  })

  it('maps image align to email-safe float / margin CSS', () => {
    assert.equal(normalizeCustomMarketingImageAlign('center'), 'center')
    assert.ok(customMarketingImageAlignCss('center').includes('margin-left:auto'))
    assert.ok(customMarketingImageAlignCss('center').includes('margin-right:auto'))
    assert.ok(customMarketingImageAlignCss('center').includes('float:none'))
    assert.ok(customMarketingImageAlignCss('left').includes('float:left'))
    assert.ok(customMarketingImageAlignCss('right').includes('float:right'))
    const el = document.createElement('img')
    el.setAttribute('style', 'display:block;margin-left:auto;margin-right:auto;')
    assert.equal(parseCustomMarketingImageAlign(el), 'center')
    const floated = document.createElement('img')
    floated.setAttribute('style', 'display:block;float:left;margin:0 12px 8px 0;')
    assert.equal(parseCustomMarketingImageAlign(floated), 'left')
    const dom = document.createElement('div')
    applyCustomMarketingImageAlign(dom, 'left')
    assert.equal(dom.style.float, 'left')
    applyCustomMarketingImageAlign(dom, 'center')
    assert.equal(dom.style.float, 'none')
    assert.equal(dom.style.marginLeft, 'auto')
    assert.equal(dom.style.marginRight, 'auto')
  })

  it('routes Paragraph align to image attrs when a photo is selected', () => {
    assert.deepEqual(customMarketingAlignCommandValue('center', true), {
      target: 'image',
      align: 'center'
    })
    assert.deepEqual(customMarketingAlignCommandValue('justify', true), {
      target: 'image',
      align: 'left'
    })
    assert.deepEqual(customMarketingAlignCommandValue('center', false), {
      target: 'text',
      align: 'center'
    })
  })

  it('applies Paragraph center/right via image node selection', () => {
    const mount = document.createElement('div') as unknown as HTMLElement
    document.body.appendChild(mount as unknown as Node)
    const editor = new Editor({
      element: mount,
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        CustomMarketingDraggableImage.configure({ allowBase64: true, inline: false })
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'hi' }] },
          {
            type: 'image',
            attrs: {
              src: 'https://storage.googleapis.com/bucket/a.jpg',
              width: 200,
              textAlign: 'left'
            }
          }
        ]
      }
    })
    let imagePos: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== 'image') return
      imagePos = pos
      return false
    })
    assert.ok(imagePos != null)
    editor.commands.setNodeSelection(imagePos!)
    assert.equal(editor.isActive('image'), true)
    const command = customMarketingAlignCommandValue('center', editor.isActive('image'))
    assert.equal(command.target, 'image')
    editor.chain().setNodeSelection(imagePos!).updateAttributes('image', {
      textAlign: command.align
    }).run()
    assert.equal(editor.getAttributes('image').textAlign, 'center')
    assert.ok(/margin-left:\s*auto/i.test(editor.getHTML()))
    editor.destroy()
  })

  it('serializes centered width into email-safe img HTML', () => {
    const mount = document.createElement('div') as unknown as HTMLElement
    document.body.appendChild(mount as unknown as Node)
    const editor = new Editor({
      element: mount,
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        CustomMarketingDraggableImage.configure({ allowBase64: true, inline: false })
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'image',
            attrs: {
              src: 'https://storage.googleapis.com/bucket/a.jpg',
              width: 320,
              height: 180,
              textAlign: 'center'
            }
          }
        ]
      }
    })
    const html = editor.getHTML()
    assert.ok(html.includes('src="https://storage.googleapis.com/bucket/a.jpg"'))
    assert.ok(html.includes('width="320"') || html.includes('width:320px') || html.includes('width: 320px'))
    assert.ok(/margin-left:\s*auto/i.test(html))
    assert.ok(/margin-right:\s*auto/i.test(html))
    editor.destroy()
  })

  it('deletes a selected photo from the document', () => {
    const mount = document.createElement('div') as unknown as HTMLElement
    document.body.appendChild(mount as unknown as Node)
    const editor = new Editor({
      element: mount,
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        CustomMarketingDraggableImage.configure({ allowBase64: true, inline: false })
      ],
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'before' }] },
          {
            type: 'image',
            attrs: { src: 'https://storage.googleapis.com/bucket/remove-me.jpg' }
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'after' }] }
        ]
      }
    })
    let imagePos: number | null = null
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name !== 'image') return
      imagePos = pos
      return false
    })
    assert.ok(imagePos != null)
    editor.commands.setNodeSelection(imagePos!)
    assert.equal(editor.isActive('image'), true)
    assert.equal(editor.commands.deleteSelection(), true)
    const html = editor.getHTML()
    assert.ok(!html.includes('remove-me.jpg'))
    assert.ok(html.includes('before'))
    assert.ok(html.includes('after'))
    editor.destroy()
  })
})
