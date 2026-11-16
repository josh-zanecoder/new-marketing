/** postMessage contract between this app and Marketing host. */

export const CHANNEL = 'email-grapes-builder' as const

export type HostToBuilder =
  | { channel: typeof CHANNEL; type: 'load'; html?: string; name?: string; subject?: string; templateId?: string | null }
  | { channel: typeof CHANNEL; type: 'new' }
  | { channel: typeof CHANNEL; type: 'request-save' }
  | { channel: typeof CHANNEL; type: 'ping' }
  | { channel: typeof CHANNEL; type: 'upload-result'; requestId: string; url?: string; error?: string }
  | {
      channel: typeof CHANNEL
      type: 'pick-image-result'
      requestId: string
      url?: string
      fileName?: string
      error?: string
      cancelled?: boolean
    }

export type BuilderToHost =
  | { channel: typeof CHANNEL; type: 'ready' }
  | { channel: typeof CHANNEL; type: 'save'; html: string; name?: string; subject?: string; templateId?: string | null }
  | {
      channel: typeof CHANNEL
      type: 'upload-request'
      requestId: string
      dataUrl: string
      fileName: string
    }
  | { channel: typeof CHANNEL; type: 'pick-image-request'; requestId: string }
  | { channel: typeof CHANNEL; type: 'crash'; message: string }

export function isHostMessage(data: unknown): data is HostToBuilder {
  if (!data || typeof data !== 'object') return false
  const msg = data as { channel?: unknown; type?: unknown }
  return msg.channel === CHANNEL && typeof msg.type === 'string'
}

export function postToHost(message: BuilderToHost) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*')
  }
}
