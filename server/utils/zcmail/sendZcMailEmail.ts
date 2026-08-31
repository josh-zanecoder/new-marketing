/**
 * Low-level HTTP client for the zcMail `POST /v1/mail/send` API
 * (see zc-mail OpenAPI SendMailRequest / SendMailResponse).
 */

export interface ZcMailAttachment {
  filename: string
  contentBase64: string
  contentType?: string
}

export interface SendZcMailEmailInput {
  baseUrl: string
  apiKey: string
  /** Admin tenant name (must match SES TenantName). */
  tenant: string
  /** Single address, list, or comma-separated — zcMail fans out per address. */
  to: string | string[]
  subject: string
  html?: string
  text?: string
  archive?: boolean
  /** Overrides tenant default From (email string). */
  from?: string | null
  /** Overrides tenant default Reply-To. */
  replyTo?: string | null
  cc?: string[]
  bcc?: string[]
  attachments?: ZcMailAttachment[]
  headers?: Record<string, string>
  tags?: Record<string, string>
}

export interface ZcMailSendResultItem {
  recipient: string
  role: 'to' | 'cc' | 'bcc' | string
  messageId?: string
  sesMessageId?: string
  archiveId?: string
  s3Key?: string
  status: 'sent' | 'failed' | string
  error?: string
}

export interface SendZcMailEmailResult {
  ok: true
  status: number
  body: unknown
  sent: number
  failed: number
  results: ZcMailSendResultItem[]
  /** First successful `to` messageId (or any sent result). */
  messageId: string | null
}

export class ZcMailSendError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ZcMailSendError'
    this.status = status
    this.body = body
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function normalizeAddressList(value: string | string[] | undefined): string[] {
  if (value == null) return []
  const raw = Array.isArray(value) ? value : value.split(',')
  const seen = new Set<string>()
  const out: string[] = []
  for (const addr of raw) {
    const trimmed = addr.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

function parseSendResponse(body: unknown): {
  sent: number
  failed: number
  results: ZcMailSendResultItem[]
  messageId: string | null
} {
  if (!body || typeof body !== 'object') {
    return { sent: 0, failed: 0, results: [], messageId: null }
  }
  const record = body as Record<string, unknown>
  const sent = typeof record.sent === 'number' ? record.sent : 0
  const failed = typeof record.failed === 'number' ? record.failed : 0
  const results: ZcMailSendResultItem[] = []
  if (Array.isArray(record.results)) {
    for (const item of record.results) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      const recipient = typeof row.recipient === 'string' ? row.recipient : ''
      if (!recipient) continue
      results.push({
        recipient,
        role: typeof row.role === 'string' ? row.role : 'to',
        messageId: typeof row.messageId === 'string' ? row.messageId : undefined,
        sesMessageId: typeof row.sesMessageId === 'string' ? row.sesMessageId : undefined,
        archiveId: typeof row.archiveId === 'string' ? row.archiveId : undefined,
        s3Key: typeof row.s3Key === 'string' ? row.s3Key : undefined,
        status: typeof row.status === 'string' ? row.status : 'sent',
        error: typeof row.error === 'string' ? row.error : undefined
      })
    }
  }

  const firstSent =
    results.find((r) => r.status === 'sent' && r.role === 'to' && (r.sesMessageId || r.messageId)) ||
    results.find((r) => r.status === 'sent' && (r.sesMessageId || r.messageId)) ||
    null

  return {
    sent,
    failed,
    results,
    messageId: firstSent?.sesMessageId || firstSent?.messageId || null
  }
}

function extractErrorDetail(parsed: unknown, rawText: string): string {
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    if (typeof record.error === 'string' && record.error.trim()) {
      const code = typeof record.code === 'string' ? ` [${record.code}]` : ''
      return `${record.error.trim()}${code}`
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim()
    }
  }
  return rawText.slice(0, 300)
}

/**
 * POST `{baseUrl}/v1/mail/send` with `X-API-Key`.
 * Omit `from` / `replyTo` so zcMail applies tenant defaults.
 * Either `html` or `text` is required by the API.
 */
export async function sendZcMailEmail(
  input: SendZcMailEmailInput,
  fetchImpl: typeof fetch = fetch
): Promise<SendZcMailEmailResult> {
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  if (!baseUrl) {
    throw new ZcMailSendError('zcMail base URL is required', 0, null)
  }
  const apiKey = input.apiKey.trim()
  if (!apiKey) {
    throw new ZcMailSendError('zcMail API key is required', 0, null)
  }
  const tenant = input.tenant.trim()
  if (!tenant) {
    throw new ZcMailSendError('zcMail tenant is required', 0, null)
  }

  const toList = normalizeAddressList(input.to)
  if (toList.length === 0) {
    throw new ZcMailSendError('Recipient email is required', 0, null)
  }

  const html = input.html?.trim() || ''
  const text = input.text?.trim() || ''
  if (!html && !text) {
    throw new ZcMailSendError('Either html or text is required', 0, null)
  }

  const body: Record<string, unknown> = {
    tenant,
    to: toList.length === 1 ? toList[0] : toList,
    subject: input.subject,
    archive: input.archive !== false
  }
  if (html) body.html = html
  if (text) body.text = text

  const from = input.from?.trim()
  if (from) body.from = from

  const replyTo = input.replyTo?.trim()
  if (replyTo) body.replyTo = replyTo

  const cc = normalizeAddressList(input.cc)
  if (cc.length > 0) body.cc = cc

  const bcc = normalizeAddressList(input.bcc)
  if (bcc.length > 0) body.bcc = bcc

  if (input.attachments?.length) {
    body.attachments = input.attachments.map((att) => ({
      filename: att.filename,
      contentBase64: att.contentBase64,
      ...(att.contentType ? { contentType: att.contentType } : {})
    }))
  }

  if (input.headers && Object.keys(input.headers).length > 0) {
    body.headers = input.headers
  }
  if (input.tags && Object.keys(input.tags).length > 0) {
    body.tags = input.tags
  }

  const url = `${baseUrl}/v1/mail/send`
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify(body)
  })

  let parsed: unknown = null
  const rawText = await response.text()
  if (rawText) {
    try {
      parsed = JSON.parse(rawText)
    } catch {
      parsed = rawText
    }
  }

  if (!response.ok) {
    const detail = extractErrorDetail(parsed, rawText)
    throw new ZcMailSendError(
      `zcMail send failed (${response.status})${detail ? `: ${detail}` : ''}`,
      response.status,
      parsed
    )
  }

  const parsedResponse = parseSendResponse(parsed)
  if (parsedResponse.failed > 0 && parsedResponse.sent === 0) {
    const firstError =
      parsedResponse.results.find((r) => r.status === 'failed')?.error || 'all recipients failed'
    throw new ZcMailSendError(`zcMail send failed: ${firstError}`, response.status, parsed)
  }

  return {
    ok: true,
    status: response.status,
    body: parsed,
    sent: parsedResponse.sent,
    failed: parsedResponse.failed,
    results: parsedResponse.results,
    messageId: parsedResponse.messageId
  }
}
