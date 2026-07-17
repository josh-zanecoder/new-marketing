import { Node, mergeAttributes, type JSONContent } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    customMarketingColumns: {
      /** Insert a 2-column layout. If an image is selected, it moves into the left column. */
      insertCustomMarketingTwoColumns: () => ReturnType
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
        }
    }
  }
})
