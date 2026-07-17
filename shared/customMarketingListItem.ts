import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import { ListItem } from '@tiptap/extension-list'
import { TextSelection } from '@tiptap/pm/state'

/**
 * Default TipTap list item content (`paragraph block*`) so toggle bullet/number
 * can wrap a multi-paragraph selection. Enter still creates a new item via
 * {@link splitOrInsertListItem} (not a nested paragraph).
 */
export const CustomMarketingListItem = ListItem.extend({
  content: 'paragraph block*',
  priority: 1010,
  addKeyboardShortcuts() {
    return {
      Enter: () => splitOrInsertListItem(this.editor, this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name)
    }
  }
})

/** High-priority Enter handler so list splitting wins over default paragraph split. */
export const CustomMarketingListEnter = Extension.create({
  name: 'customMarketingListEnter',
  priority: 10_000,
  addKeyboardShortcuts() {
    return {
      Enter: () => splitOrInsertListItem(this.editor, 'listItem')
    }
  }
})

function findListItemDepth($from: Editor['state']['selection']['$from'], itemName: string): number {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === itemName) return depth
  }
  return -1
}

/**
 * Split the current list item at the cursor, or insert an empty item after it.
 * Does not rely on document "end" focus (TrailingNode empty `<p>` after lists).
 */
export function splitOrInsertListItem(editor: Editor, itemName: string): boolean {
  const { state } = editor
  const { $from } = state.selection
  const listItemDepth = findListItemDepth($from, itemName)
  if (listItemDepth < 0) return false

  const listItemType = state.schema.nodes[itemName]
  const paragraphType = state.schema.nodes.paragraph
  if (!listItemType || !paragraphType) return false

  // Empty list row + Enter → leave the list (Word/Gmail behavior).
  if ($from.parent.type.name === 'paragraph' && $from.parent.content.size === 0) {
    return editor.commands.liftListItem(itemName)
  }

  if (editor.commands.splitListItem(itemName)) return true

  // Fallback: insert a new empty list item immediately after the current one.
  const listItemNode = $from.node(listItemDepth)
  const listItemPos = $from.before(listItemDepth)
  const insertPos = listItemPos + listItemNode.nodeSize
  const newItem = listItemType.createAndFill()
  if (!newItem) return false

  let tr = state.tr.insert(insertPos, newItem)
  const cursorPos = insertPos + 1
  tr = tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos))).scrollIntoView()
  editor.view.dispatch(tr)
  return true
}
