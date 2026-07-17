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
import {
  CustomMarketingListEnter,
  CustomMarketingListItem,
  splitOrInsertListItem
} from '../customMarketingListItem'

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

function createEditor(window: Window): Editor {
  const mount = window.document.createElement('div')
  window.document.body.appendChild(mount)
  // happy-dom's HTMLElement is not the same type as lib.dom Element TipTap expects.
  return new Editor({
    element: mount as unknown as HTMLElement,
    content: {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
            }
          ]
        }
      ]
    },
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
      Placeholder.configure({ placeholder: 'Start typing…' })
    ]
  })
}

describe('customMarketingListItem', () => {
  it('keeps listItem content compatible with TipTap wrap (toggle list)', () => {
    assert.equal(CustomMarketingListItem.config.content, 'paragraph block*')
    assert.ok((CustomMarketingListItem.config.priority ?? 0) >= 1000)
  })

  it('creates a second list item when Enter splits after Hello (full editor stack)', () => {
    const window = installDom()
    const editor = createEditor(window)
    // Place caret at end of "Hello" inside the list item (not after the list).
    const helloEnd = 1 + 1 + 1 + 1 + 'Hello'.length
    editor.commands.setTextSelection(helloEnd)
    assert.equal(editor.isActive('listItem'), true)
    assert.equal(splitOrInsertListItem(editor, 'listItem'), true)
    const html = editor.getHTML()
    assert.equal((html.match(/<li>/g) ?? []).length, 2)
    assert.match(html, /Hello/)
    assert.equal(html.includes('<ul><li><p>Hello</p></li></ul><p></p>'), false)
    editor.destroy()
    window.close()
  })

  it('wraps a multi-paragraph selection into a bullet list', () => {
    const window = installDom()
    const mount = window.document.createElement('div')
    window.document.body.appendChild(mount)
    const editor = new Editor({
      element: mount as unknown as HTMLElement,
      content: '<p>Dear friend,</p><p>I wanted to reach out.</p><p>Best regards,</p>',
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
        CustomMarketingListEnter
      ]
    })
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 })
    assert.equal(editor.chain().focus().toggleBulletList().run(), true)
    const html = editor.getHTML()
    assert.match(html, /^<ul>/)
    assert.equal((html.match(/<li>/g) ?? []).length, 3)
    editor.destroy()
    window.close()
  })

  it('does not append a trailing empty paragraph after the list', () => {
    const window = installDom()
    const editor = createEditor(window)
    assert.equal(editor.getHTML(), '<ul><li><p>Hello</p></li></ul>')
    editor.destroy()
    window.close()
  })
})
