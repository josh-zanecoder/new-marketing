import { BrevoClient } from '@getbrevo/brevo'
import type { GetEmailEventReportRequest } from '@getbrevo/brevo/transactionalEmails'

function getBrevoApiKey(): string {
  try {
    const config = useRuntimeConfig()
    const key = config.brevoApiKey || process.env.BREVO_API_KEY || ''
    return key
  } catch {
    return process.env.BREVO_API_KEY || ''
  }
}

export interface SendEmailParams {
  sender: { name: string; email: string }
  to: { email: string; name?: string }[]
  subject: string
  htmlContent: string
  tags?: string[]
  /** When set, a `tenant:{value}` tag is sent to Brevo (prefer marketing registry `tenantId`; else DB name). */
  tenantId?: string
  /** When set, a `db:{dbName}` tag is sent to Brevo (MongoDB database name). */
  dbName?: string
  /** When set, a `user:{user}` tag is sent to Brevo (e.g. CRM user email). */
  user?: string
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

function extractBrevoError(e: unknown): string {
  if (e == null) return 'Unknown Brevo error'
  if (typeof e !== 'object') return String(e)
  const o = e as Record<string, unknown>
  const body = o.body
  const data = o.data
  const bodyMsg =
    body && typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message: unknown }).message
      : undefined
  const dataMsg =
    data && typeof data === 'object' && data !== null && 'message' in data
      ? (data as { message: unknown }).message
      : undefined
  const dataCode =
    data && typeof data === 'object' && data !== null && 'code' in data
      ? (data as { code: unknown }).code
      : undefined
  const msg = bodyMsg ?? o.message ?? dataMsg ?? dataCode
  if (msg != null) return String(msg)
  if (body && typeof body === 'object') return JSON.stringify(body)
  if (data && typeof data === 'object') return JSON.stringify(data)
  if (typeof o.message === 'string') return o.message
  return 'Unknown Brevo error'
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId?: string; error?: string }> {
  const client = getBrevoClient()
  if (!client) {
    console.error('[Brevo] API key is not configured')
    return { error: 'Brevo API key is not configured' }
  }

  try {
    const tags: string[] = []
    if (params.tenantId?.trim()) tags.push(`tenant:${params.tenantId.trim()}`)
    if (params.dbName?.trim()) tags.push(`db:${params.dbName.trim()}`)
    if (params.user?.trim()) tags.push(`user:${params.user.trim()}`)
    if (params.tags?.length) tags.push(...params.tags)

    const result = await client.transactionalEmails.sendTransacEmail({
      sender: { email: params.sender.email, name: params.sender.name },
      to: params.to.map((r) => ({ email: r.email, name: r.name })),
      subject: params.subject,
      htmlContent: params.htmlContent,
      ...(tags.length ? { tags } : {})
    })
    const messageId = result?.messageId || undefined

    if (messageId) {
      console.log('[Brevo] Email sent:', { messageId, to: params.to[0]?.email })
    }
    return { messageId }
  } catch (e: unknown) {
    const err = extractBrevoError(e)
    const status =
      typeof e === 'object' && e !== null && 'statusCode' in e
        ? (e as { statusCode?: unknown }).statusCode
        : typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { status?: unknown } }).response?.status
          : undefined
    console.error('[Brevo] Send failed:', err, { to: params.to[0]?.email, statusCode: status })
    return { error: err }
  }
}

export async function getTransactionalEmailEventReport(
  params: GetEmailEventReportRequest = {}
): Promise<{ report?: unknown; error?: string }> {
  const client = getBrevoClient()
  if (!client) {
    console.error('[Brevo] API key is not configured')
    return { error: 'Brevo API key is not configured' }
  }

  try {
    const report = await client.transactionalEmails.getEmailEventReport(params)
    return { report }
  } catch (e: unknown) {
    const err = extractBrevoError(e)
    console.error('[Brevo] getEmailEventReport failed:', err)
    return { error: err }
  }
}
