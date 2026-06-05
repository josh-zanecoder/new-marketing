import { BrevoClient } from '@getbrevo/brevo'
import type { GetEmailEventReportRequest } from '@getbrevo/brevo/transactionalEmails'
import {
  buildCampaignBrevoBatchRequest,
  type CampaignBatchMessageVersion
} from '../utils/campaignSend/buildCampaignBrevoBatchRequest'

export type { CampaignBatchMessageVersion }

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
  /** When set, recipients reply to this address (Brevo requires `name`). */
  replyTo?: { email: string; name: string }
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

export async function sendCampaignBatchWithMessageVersions(params: {
  sender: SendEmailParams['sender']
  replyTo?: SendEmailParams['replyTo']
  messageVersions: CampaignBatchMessageVersion[]
  tags?: string[]
  tenantId?: string
  dbName?: string
  user?: string
  /** Brevo `Idempotency-Key` header — stable per logical batch retry. */
  idempotencyKey?: string
}): Promise<{ messageIds: (string | null)[]; error?: string }> {
  const client = getBrevoClient()
  if (!client) {
    console.error('[Brevo] API key is not configured')
    return { messageIds: [], error: 'Brevo API key is not configured' }
  }
  if (params.messageVersions.length === 0) {
    return { messageIds: [] }
  }

  const tags: string[] = []
  if (params.tenantId?.trim()) tags.push(`tenant:${params.tenantId.trim()}`)
  if (params.dbName?.trim()) tags.push(`db:${params.dbName.trim()}`)
  if (params.user?.trim()) tags.push(`user:${params.user.trim()}`)
  if (params.tags?.length) tags.push(...params.tags)

  const headers: Record<string, unknown> = {}
  const idem = String(params.idempotencyKey || '').trim()
  if (idem) headers['Idempotency-Key'] = idem

  const { subject: rootSubject, htmlContent: rootHtml, messageVersions, uniform } =
    buildCampaignBrevoBatchRequest(params.messageVersions)

  const replyToKey = (rt?: { email: string; name: string }) => {
    if (!rt?.email?.includes('@') || !rt.name?.trim()) return ''
    return `${rt.email.trim().toLowerCase()}|${rt.name.trim()}`
  }
  const versionReplyKeys = messageVersions.map((v) => replyToKey(v.replyTo))
  const sharedVersionReplyTo =
    versionReplyKeys.length > 0 &&
    versionReplyKeys[0] &&
    versionReplyKeys.every((k) => k === versionReplyKeys[0])
      ? messageVersions[0]?.replyTo
      : undefined
  const rootReplyTo = params.replyTo ?? sharedVersionReplyTo

  try {
    const result = await client.transactionalEmails.sendTransacEmail({
      sender: { email: params.sender.email, name: params.sender.name },
      subject: rootSubject,
      htmlContent: rootHtml,
      ...(rootReplyTo?.email?.includes('@') && rootReplyTo.name?.trim()
        ? {
            replyTo: {
              email: rootReplyTo.email.trim().toLowerCase(),
              name: rootReplyTo.name.trim().slice(0, 70)
            }
          }
        : {}),
      messageVersions,
      ...(tags.length ? { tags } : {}),
      ...(Object.keys(headers).length ? { headers } : {})
    })

    const body = result as { messageId?: string; messageIds?: string[] }
    const fromArray = (body.messageIds ?? []).filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0
    )
    const singular =
      typeof body.messageId === 'string' && body.messageId.trim().length > 0
        ? body.messageId.trim()
        : ''
    const n = params.messageVersions.length
    const messageIds = alignBrevoMessageIdsToRecipients(n, fromArray, singular)
    const missing = messageIds.filter((id) => id == null || String(id).trim().length === 0).length
    if (missing > 0) {
      console.warn('[Brevo] Campaign batch messageIds partially missing', {
        recipientCount: n,
        messageIdCount: fromArray.length,
        missingCount: missing
      })
    }
    if (uniform && n > 1) {
      console.log('[Brevo] Campaign batch sent uniform messageVersions', { recipientCount: n })
    }
    return { messageIds }
  } catch (e: unknown) {
    const err = extractBrevoError(e)
    console.error('[Brevo] Campaign batch send failed:', err)
    return { messageIds: [], error: err }
  }
}

function alignBrevoMessageIdsToRecipients(
  n: number,
  fromArray: string[],
  singular: string
): (string | null)[] {
  if (n <= 0) return []
  if (fromArray.length === n) return fromArray.map((id) => id ?? null)
  if (n === 1 && fromArray.length >= 1) return [fromArray[0] ?? null]
  if (n === 1 && singular) return [singular]
  const out: (string | null)[] = Array.from({ length: n }, () => null)
  if (fromArray.length > n) {
    for (let i = 0; i < n; i++) out[i] = fromArray[i] ?? null
    return out
  }
  for (let i = 0; i < fromArray.length; i++) out[i] = fromArray[i] ?? null
  return out
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
      ...(params.replyTo?.email?.includes('@') && params.replyTo.name?.trim()
        ? {
            replyTo: {
              email: params.replyTo.email.trim().toLowerCase(),
              name: params.replyTo.name.trim().slice(0, 70)
            }
          }
        : {}),
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
