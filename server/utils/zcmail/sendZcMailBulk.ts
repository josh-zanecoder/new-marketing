/**
 * Low-level HTTP client for zcMail `POST /v1/mail/bulk` + job poll
 * (see zc-mail OpenAPI BulkMailRequest / BulkJobStatus).
 */

import { ZcMailSendError } from './sendZcMailEmail'

export const ZC_MAIL_BULK_POLL_INTERVAL_MS = 1500
export const ZC_MAIL_BULK_POLL_MAX_ATTEMPTS = 200

export interface ZcMailBulkRecipientInput {
  to: string
  subject: string
  html: string
  replyTo?: string
  tags?: Record<string, string>
}

export interface SendZcMailBulkInput {
  baseUrl: string
  apiKey: string
  tenant: string
  from?: string | null
  replyTo?: string | null
  archive?: boolean
  concurrency?: number
  recipients: ZcMailBulkRecipientInput[]
}

export interface ZcMailBulkJobResultRow {
  status?: string
  sesMessageId?: string
  messageId?: string
  error?: string
  to?: string | string[]
}

export interface SendZcMailBulkResult {
  ok: true
  jobId: string
  status: string
  sent: number
  failed: number
  results: ZcMailBulkJobResultRow[]
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractErrorDetail(parsed: unknown, rawText: string): string {
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error.trim()
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message.trim()
    }
  }
  return rawText.slice(0, 300)
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const rawText = await response.text()
  if (!rawText) return null
  try {
    return JSON.parse(rawText) as unknown
  } catch {
    return rawText
  }
}

/**
 * zcMail `GET /v1/mail/bulk/:jobId` returns `{ job: { status, results, ... } }`.
 * Older/docs flat shapes are also accepted.
 */
export function unwrapZcMailBulkJobStatus(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null
  const root = body as Record<string, unknown>
  if (root.job && typeof root.job === 'object') {
    return root.job as Record<string, unknown>
  }
  return root
}

/**
 * Enqueue bulk send and wait until the job completes or fails.
 */
export async function sendZcMailBulk(
  input: SendZcMailBulkInput,
  fetchImpl: typeof fetch = fetch,
  options?: { pollIntervalMs?: number; maxAttempts?: number }
): Promise<SendZcMailBulkResult> {
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
  if (!input.recipients.length) {
    throw new ZcMailSendError('zcMail bulk recipients list is empty', 0, null)
  }

  const body: Record<string, unknown> = {
    tenant,
    archive: input.archive !== false,
    concurrency: input.concurrency ?? 5,
    recipients: input.recipients.map((recipient) => ({
      to: recipient.to,
      subject: recipient.subject,
      html: recipient.html,
      ...(recipient.replyTo ? { replyTo: recipient.replyTo } : {}),
      ...(recipient.tags ? { tags: recipient.tags } : {})
    }))
  }
  const from = input.from?.trim()
  if (from) body.from = from
  const replyTo = input.replyTo?.trim()
  if (replyTo) body.replyTo = replyTo

  const enqueueResponse = await fetchImpl(`${baseUrl}/v1/mail/bulk`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify(body)
  })
  const enqueueParsed = await parseJsonResponse(enqueueResponse)
  if (!enqueueResponse.ok) {
    const detail = extractErrorDetail(enqueueParsed, '')
    throw new ZcMailSendError(
      `zcMail bulk enqueue failed (${enqueueResponse.status})${detail ? `: ${detail}` : ''}`,
      enqueueResponse.status,
      enqueueParsed
    )
  }

  const jobId =
    enqueueParsed && typeof enqueueParsed === 'object' && 'jobId' in enqueueParsed
      ? String((enqueueParsed as { jobId?: unknown }).jobId ?? '').trim()
      : ''
  if (!jobId) {
    throw new ZcMailSendError(
      'zcMail bulk enqueue did not return jobId',
      enqueueResponse.status,
      enqueueParsed
    )
  }

  const pollIntervalMs = options?.pollIntervalMs ?? ZC_MAIL_BULK_POLL_INTERVAL_MS
  const maxAttempts = options?.maxAttempts ?? ZC_MAIL_BULK_POLL_MAX_ATTEMPTS
  const statusUrl = `${baseUrl}/v1/mail/bulk/${encodeURIComponent(jobId)}`

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const statusResponse = await fetchImpl(statusUrl, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': apiKey
      }
    })
    const statusParsed = await parseJsonResponse(statusResponse)
    if (!statusResponse.ok) {
      throw new ZcMailSendError(
        `zcMail bulk status failed (${statusResponse.status}) for job ${jobId}`,
        statusResponse.status,
        statusParsed
      )
    }
    if (!statusParsed || typeof statusParsed !== 'object') {
      throw new ZcMailSendError(
        'zcMail bulk job response was empty',
        statusResponse.status,
        statusParsed
      )
    }

    const row = unwrapZcMailBulkJobStatus(statusParsed)
    if (!row) {
      throw new ZcMailSendError(
        'zcMail bulk job response was empty',
        statusResponse.status,
        statusParsed
      )
    }
    const status = typeof row.status === 'string' ? row.status : ''
    const results = Array.isArray(row.results) ? (row.results as ZcMailBulkJobResultRow[]) : []
    const sent = typeof row.sent === 'number' ? row.sent : 0
    const failed = typeof row.failed === 'number' ? row.failed : 0

    if (status === 'completed' || status === 'failed') {
      if (status === 'failed' && sent === 0) {
        const err =
          typeof row.error === 'string' && row.error.trim()
            ? row.error.trim()
            : 'zcMail bulk job failed with no successful sends'
        throw new ZcMailSendError(err, statusResponse.status, statusParsed)
      }
      return {
        ok: true,
        jobId,
        status,
        sent,
        failed,
        results
      }
    }

    await sleep(pollIntervalMs)
  }

  throw new ZcMailSendError(`zcMail bulk job ${jobId} timed out waiting for completion`, 0, null)
}

export function alignZcMailBulkResultsToRecipients(
  n: number,
  results: Array<{ status?: string; sesMessageId?: string; messageId?: string }>
): (string | null)[] {
  const out: (string | null)[] = Array.from({ length: n }, () => null)
  for (let i = 0; i < n; i += 1) {
    const row = results[i]
    if (!row) continue
    const status = String(row.status || '').toLowerCase()
    if (status !== 'sent') continue
    const sesId = typeof row.sesMessageId === 'string' ? row.sesMessageId.trim() : ''
    const msgId = typeof row.messageId === 'string' ? row.messageId.trim() : ''
    out[i] = sesId || msgId || null
  }
  return out
}
