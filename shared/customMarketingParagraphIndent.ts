import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    paragraphIndent: {
      indentParagraph: () => ReturnType
      outdentParagraph: () => ReturnType
    }
  }
}

const INDENT_STEP_PX = 24
const MAX_INDENT_LEVEL = 8

function readIndentLevel(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.min(Math.floor(n), MAX_INDENT_LEVEL)
}

/**
 * Word-like paragraph indent (margin-left levels). Falls back to list
 * sink/lift when the cursor is inside a list item.
 */
export const CustomMarketingParagraphIndent = Extension.create({
  name: 'paragraphIndent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.style.marginLeft || element.getAttribute('data-indent') || ''
              if (!raw) return 0
              if (/^\d+$/.test(raw)) return readIndentLevel(raw)
              const px = Number.parseInt(raw, 10)
              if (!Number.isFinite(px) || px <= 0) return 0
              return readIndentLevel(Math.round(px / INDENT_STEP_PX))
            },
            renderHTML: (attributes) => {
              const level = readIndentLevel(attributes.indent)
              if (level <= 0) return {}
              return {
                'data-indent': String(level),
                style: `margin-left: ${level * INDENT_STEP_PX}px`
              }
            }
          }
        }
      }
    ]
  },
  addCommands() {
    return {
      indentParagraph: () => ({ editor, commands }) => {
        if (editor.isActive('listItem')) {
          return commands.sinkListItem('listItem')
        }
        const level = readIndentLevel(editor.getAttributes('paragraph').indent)
        return commands.updateAttributes('paragraph', {
          indent: Math.min(level + 1, MAX_INDENT_LEVEL)
        })
      },
      outdentParagraph: () => ({ editor, commands }) => {
        if (editor.isActive('listItem')) {
          return commands.liftListItem('listItem')
        }
        const level = readIndentLevel(editor.getAttributes('paragraph').indent)
        return commands.updateAttributes('paragraph', {
          indent: Math.max(level - 1, 0)
        })
      }
    }
  }
})

export function nextParagraphIndentLevel(current: unknown, direction: 'in' | 'out'): number {
  const level = readIndentLevel(current)
  if (direction === 'in') return Math.min(level + 1, MAX_INDENT_LEVEL)
  return Math.max(level - 1, 0)
}
