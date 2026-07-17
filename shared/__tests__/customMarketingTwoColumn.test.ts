import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Window } from 'happy-dom'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { CustomMarketingParagraphIndent } from '../customMarketingParagraphIndent'
import { CustomMarketingListEnter, CustomMarketingListItem } from '../customMarketingListItem'
import {
  buildCustomMarketingTwoColumnContent,
  CUSTOM_MARKETING_COLUMNS_TABLE_STYLE,
  CUSTOM_MARKETING_COLUMN_CELL_STYLE,
  CustomMarketingColumn,
  CustomMarketingColumns
} from '../customMarketingTwoColumn'

function installDom(): Window {
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
    value: (cb: (time: number) => void) => setTimeout(() => cb(Date.now()), 0),
    configurable: true
  })
  return window
}

function createEditor(window: Window, content?: object): Editor {
  const mount = window.document.createElement('div')
  window.document.body.appendChild(mount)
  return new Editor({
    element: mount as unknown as HTMLElement,
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        underline: false,
        listItem: false,
        trailingNode: false
      }),
      CustomMarketingListItem,
      CustomMarketingListEnter,
      TextStyleKit,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['paragraph'],
        alignments: ['left', 'center', 'right', 'justify']
      }),
      CustomMarketingParagraphIndent,
      Image.configure({ allowBase64: true, inline: false }),
      CustomMarketingColumns,
      CustomMarketingColumn,
      Placeholder.configure({ placeholder: 'Start typing…' })
    ]
  })
}

describe('customMarketingTwoColumn', () => {
  it('builds empty two-column JSON with two cells', () => {
    const json = buildCustomMarketingTwoColumnContent()
    assert.equal(json.type, 'customMarketingColumns')
    assert.equal(json.content?.length, 2)
    assert.equal(json.content?.[0]?.type, 'customMarketingColumn')
    assert.equal(json.content?.[1]?.type, 'customMarketingColumn')
    assert.equal(json.content?.[0]?.content?.[0]?.type, 'paragraph')
  })

  it('puts a selected image into the left column JSON', () => {
    const json = buildCustomMarketingTwoColumnContent({
      leftImageAttrs: { src: 'https://example.com/a.jpg', textAlign: 'left' }
    })
    const left = json.content?.[0]?.content
    assert.equal(left?.[0]?.type, 'image')
    assert.equal(left?.[0]?.attrs?.src, 'https://example.com/a.jpg')
    assert.equal(left?.[1]?.type, 'paragraph')
  })

  it('keeps email-safe table cell styles', () => {
    assert.match(CUSTOM_MARKETING_COLUMNS_TABLE_STYLE, /table-layout:fixed/)
    assert.match(CUSTOM_MARKETING_COLUMN_CELL_STYLE, /width:50%/)
    assert.match(CUSTOM_MARKETING_COLUMN_CELL_STYLE, /vertical-align:top/)
  })

  it('inserts two columns and renders a presentation table', () => {
    const window = installDom()
    const editor = createEditor(window)
    const ok = editor.commands.insertCustomMarketingTwoColumns()
    assert.equal(ok, true)
    const html = editor.getHTML()
    assert.match(html, /data-custom-marketing-columns/)
    assert.match(html, /role="presentation"/)
    assert.equal((html.match(/data-custom-marketing-column(?!s)/g) ?? []).length, 2)
    editor.destroy()
  })

  it('wraps a selected image into the left column', () => {
    const window = installDom()
    const editor = createEditor(window, {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: 'https://example.com/photo.jpg' }
        }
      ]
    })
    editor.commands.setNodeSelection(0)
    assert.equal(editor.isActive('image'), true)
    const ok = editor.commands.insertCustomMarketingTwoColumns()
    assert.equal(ok, true)
    const html = editor.getHTML()
    assert.match(html, /data-custom-marketing-columns/)
    assert.match(html, /src="https:\/\/example\.com\/photo\.jpg"/)
    editor.destroy()
  })

  it('removes two columns and keeps cell content', () => {
    const window = installDom()
    const editor = createEditor(window)
    assert.equal(editor.commands.insertCustomMarketingTwoColumns(), true)
    // Place caret in the right column paragraph and type.
    editor.commands.setTextSelection(editor.state.doc.content.size - 2)
    editor.commands.insertContent('Hello beside')
    assert.match(editor.getHTML(), /data-custom-marketing-columns/)
    assert.equal(editor.commands.deleteCustomMarketingTwoColumns(), true)
    const html = editor.getHTML()
    assert.doesNotMatch(html, /data-custom-marketing-columns/)
    assert.match(html, /Hello beside/)
    editor.destroy()
  })
})
