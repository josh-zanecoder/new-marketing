import { BrevoClient } from '@getbrevo/brevo'
import { getBrevoApiKey } from '../utils/brevo'

export interface SendEmailParams {
  sender: { name: string; email: string }
  to: { email: string; name?: string }[]
  subject: string
  htmlContent: string
}

let brevoClient: BrevoClient | null = null

function getBrevoClient(): BrevoClient | null {
  const apiKey = getBrevoApiKey()
  if (!apiKey) return null

  if (!brevoClient) {
    brevoClient = new BrevoClient({ apiKey })
  }
  return brevoClient
}

function extractBrevoError(e: any): string {
  if (!e) return 'Unknown Brevo error'
  const msg = e?.body?.message ?? e?.message ?? e?.data?.message ?? e?.data?.code
  if (msg) return String(msg)
  if (e?.body && typeof e.body === 'object') return JSON.stringify(e.body)
  if (e?.data && typeof e.data === 'object') return JSON.stringify(e.data)
  return e?.message || 'Unknown Brevo error'
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId?: string; error?: string }> {
  const client = getBrevoClient()
  if (!client) {
    console.error('[Brevo] API key is not configured')
    return { error: 'Brevo API key is not configured' }
  }

  try {
    const result = await client.transactionalEmails.sendTransacEmail({
      sender: { email: params.sender.email, name: params.sender.name },
      to: params.to.map((r) => ({ email: r.email, name: r.name })),
      subject: params.subject,
      htmlContent: params.htmlContent,
    })
    const messageId = result?.messageId || undefined

    if (messageId) {
      console.log('[Brevo] Email sent:', { messageId, to: params.to[0]?.email })
    }
    return { messageId }
  } catch (e: any) {
    const err = extractBrevoError(e)
    const status = e?.statusCode ?? e?.response?.status
    console.error('[Brevo] Send failed:', err, { to: params.to[0]?.email, statusCode: status })
    return { error: err }
  }
}
