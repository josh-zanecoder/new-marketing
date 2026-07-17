import { Node, mergeAttributes, type JSONContent } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { createCustomMarketingNodeDeleteButton } from './customMarketingEditorDeleteControl'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customMarketingColumns: {
      /** Insert a 2-column layout. If an image is selected, it moves into the left column. */
      insertCustomMarketingTwoColumns: () => ReturnType
      /** Remove the surrounding two-column layout; keeps cell content in document order. */
      deleteCustomMarketingTwoColumns: () => ReturnType
    }
  }
}

/** Email-safe table styles (Gmail / Outlook prefer tables over CSS grid/flex). */
export const CUSTOM_MARKETING_COLUMNS_TABLE_STYLE =
  'width:100%;border-collapse:collapse;table-layout:fixed;margin:8px 0;'

export const CUSTOM_MARKETING_COLUMN_CELL_STYLE =
  'width:50%;vertical-align:top;padding:4px 8px;'

/** TipTap JSON for an empty (or image+text) two-column block. */
export function buildCustomMarketingTwoColumnContent(options?: {
  leftImageAttrs?: Record<string, unknown> | null
}): JSONContent {
  const attrs = options?.leftImageAttrs
  const src = attrs && typeof attrs.src === 'string' ? attrs.src.trim() : ''
  const leftContent: JSONContent[] = src
    ? [{ type: 'image', attrs: { ...attrs } }, { type: 'paragraph' }]
    : [{ type: 'paragraph' }]
  return {
    type: 'customMarketingColumns',
    content: [
      { type: 'customMarketingColumn', content: leftContent },
      { type: 'customMarketingColumn', content: [{ type: 'paragraph' }] }
    ]
  }
}

/** Locate the enclosing two-column block around the current selection. */
export function findCustomMarketingColumnsRange(
  state: EditorState
): { from: number; to: number; node: ProseMirrorNode } | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'customMarketingColumns') continue
    const from = $from.before(depth)
    return { from, to: from + node.nodeSize, node }
  }
  return null
}

/** Flatten both column cells into a single block fragment (document order). */
export function flattenCustomMarketingColumnsContent(
  columnsNode: ProseMirrorNode
): ProseMirrorNode[] {
  const blocks: ProseMirrorNode[] = []
  columnsNode.forEach((column) => {
    column.forEach((child) => {
      blocks.push(child)
    })
  })
  return blocks
}

/** Replace a columns node at `pos` with its flattened cell content. */
export function applyDeleteCustomMarketingColumnsAt(
  tr: Transaction,
  pos: number,
  columnsNode: ProseMirrorNode
): Transaction {
  const blocks = flattenCustomMarketingColumnsContent(columnsNode)
  if (blocks.length === 0) return tr.delete(pos, pos + columnsNode.nodeSize)
  return tr.replaceWith(pos, pos + columnsNode.nodeSize, blocks)
}

/** One column cell — holds paragraphs, lists, and images. */
export const CustomMarketingColumn = Node.create({
  name: 'customMarketingColumn',
  content: 'block+',
  isolating: true,
  defining: true,
  parseHTML() {
    return [{ tag: 'td[data-custom-marketing-column]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'td',
      mergeAttributes(HTMLAttributes, {
        'data-custom-marketing-column': '',
        valign: 'top',
        style: CUSTOM_MARKETING_COLUMN_CELL_STYLE
      }),
      0
    ]
  }
})

/**
 * Two-column layout rendered as a presentation table so email clients keep
 * image | text side-by-side (the white space next to a photo).
 */
export const CustomMarketingColumns = Node.create({
  name: 'customMarketingColumns',
  group: 'block',
  content: 'customMarketingColumn{2}',
  isolating: true,
  defining: true,
  parseHTML() {
    return [{ tag: 'table[data-custom-marketing-columns]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'table',
      mergeAttributes(HTMLAttributes, {
        'data-custom-marketing-columns': '',
        role: 'presentation',
        width: '100%',
        cellpadding: '0',
        cellspacing: '0',
        border: '0',
        style: CUSTOM_MARKETING_COLUMNS_TABLE_STYLE
      }),
      ['tbody', {}, ['tr', {}, 0]]
    ]
  },
  addNodeView() {
    return ({ editor, getPos }) => {
      const wrap = document.createElement('div')
      wrap.className = 'custom-marketing-editor__columns'
      wrap.setAttribute('data-custom-marketing-columns-wrap', '')

      const table = document.createElement('table')
      table.setAttribute('data-custom-marketing-columns', '')
      table.setAttribute('role', 'presentation')
      table.setAttribute('width', '100%')
      table.setAttribute('cellpadding', '0')
      table.setAttribute('cellspacing', '0')
      table.setAttribute('border', '0')
      table.style.cssText = CUSTOM_MARKETING_COLUMNS_TABLE_STYLE

      const tbody = document.createElement('tbody')
      const tr = document.createElement('tr')
      tbody.appendChild(tr)
      table.appendChild(tbody)

      const deleteButton = createCustomMarketingNodeDeleteButton({
        ariaLabel: 'Remove two columns',
        title: 'Remove two columns (keeps content)',
        onDelete: () => {
          const pos = typeof getPos === 'function' ? getPos() : undefined
          if (typeof pos !== 'number') {
            editor.commands.deleteCustomMarketingTwoColumns()
            return
          }
          const node = editor.state.doc.nodeAt(pos)
          if (!node || node.type.name !== 'customMarketingColumns') return
          const trDoc = applyDeleteCustomMarketingColumnsAt(editor.state.tr, pos, node)
          editor.view.dispatch(trDoc)
          editor.commands.focus()
        }
      })

      wrap.appendChild(deleteButton)
      wrap.appendChild(table)

      return {
        dom: wrap,
        contentDOM: tr,
        ignoreMutation: (mutation) => {
          if (mutation.type === 'selection') return false
          return !wrap.contains(mutation.target)
        },
        selectNode: () => {
          wrap.classList.add('is-selected')
        },
        deselectNode: () => {
          wrap.classList.remove('is-selected')
        }
      }
    }
  },
  addCommands() {
    return {
      insertCustomMarketingTwoColumns:
        () =>
        ({ editor, commands }) => {
          const leftImageAttrs = editor.isActive('image')
            ? editor.getAttributes('image')
            : null
          return commands.insertContent(
            buildCustomMarketingTwoColumnContent({ leftImageAttrs })
          )
        },
      deleteCustomMarketingTwoColumns:
        () =>
        ({ state, dispatch, tr }) => {
          const range = findCustomMarketingColumnsRange(state)
          if (!range) return false
          if (dispatch) {
            dispatch(applyDeleteCustomMarketingColumnsAt(tr, range.from, range.node))
          }
          return true
        }
    }
  }
})
