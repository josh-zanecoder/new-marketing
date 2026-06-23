import { getEditorDocument, resetDocument, setInspectorDrawerOpen, setSelectedBlockId, setSelectedMainTab, setSidebarTab } from './documents/editor/EditorContext'
import type { TEditorConfiguration } from './documents/editor/core'
import { setDynamicVariables, type EmailDynamicVariable } from './utils/dynamicVariablesStore'
import { exportEmailBuilderDocumentHtml } from './utils/exportEmailHtml'
import { withSyncedFullDocumentHtml } from './utils/applyEditedEmailHtml'
import { htmlToEmailBuilderDocument } from './utils/importEmailHtml'
import { migrateImportedDocument } from './utils/migrateImportedDocument'

const MESSAGE_PREFIX = 'email-builder:'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

export function initEmailBuilderParentBridge() {
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent) return
    const data = event.data
    if (!isRecord(data) || typeof data.type !== 'string') return
    if (!data.type.startsWith(MESSAGE_PREFIX)) return

    if (data.type === `${MESSAGE_PREFIX}load`) {
      const payload = data.payload
      if (isRecord(payload) && payload.document) {
        resetDocument(migrateImportedDocument(payload.document as TEditorConfiguration))
      } else if (isRecord(payload) && typeof payload.html === 'string') {
        const { document, htmlBlockId } = htmlToEmailBuilderDocument(payload.html)
        resetDocument(migrateImportedDocument(document))
        setSelectedMainTab('editor')
        if (htmlBlockId) {
          setSelectedBlockId(htmlBlockId)
          setSidebarTab('block-configuration')
          setInspectorDrawerOpen(true)
        }
      }
      window.parent.postMessage(
        { type: `${MESSAGE_PREFIX}request-dynamic-variables` },
        event.origin || window.location.origin
      )
      return
    }

    if (data.type === `${MESSAGE_PREFIX}set-dynamic-variables`) {
      const payload = data.payload
      if (isRecord(payload) && Array.isArray(payload.variables)) {
        setDynamicVariables(payload.variables as EmailDynamicVariable[])
      } else {
        setDynamicVariables([])
      }
      return
    }

    if (data.type === `${MESSAGE_PREFIX}request-export`) {
      const document = withSyncedFullDocumentHtml(getEditorDocument())
      const html = exportEmailBuilderDocumentHtml(document)
      window.parent.postMessage(
        {
          type: `${MESSAGE_PREFIX}export`,
          payload: { document, html }
        },
        event.origin || window.location.origin
      )
    }
  })

  window.parent.postMessage({ type: `${MESSAGE_PREFIX}ready` }, window.location.origin)
  window.parent.postMessage(
    { type: `${MESSAGE_PREFIX}request-dynamic-variables` },
    window.location.origin
  )
}
