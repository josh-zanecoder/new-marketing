/**
 * Outbound HTTP client for zcMail archive list/detail (Tracking Refresh).
 */

import {
  ZC_MAIL_ARCHIVE_PATH,
  ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT
} from '@server/constants/zcMailWebhook'
import type {
  ZcMailArchiveDetail,
  ZcMailArchiveListItem,
  ZcMailArchiveListResult
} from '@server/utils/zcmail/types/zcMailArchive'
import { ZcMailSendError } from '@server/utils/zcmail/sendZcMailEmail'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function asOptionalString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    .map((entry) => entry.trim())
}

function parseTags(raw: unknown): Record<string, string> | undefined {
  if (raw == null) return undefined
  const out: Record<string, string> = {}
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry !== 'string' || !entry.trim()) continue
      const idx = entry.indexOf(':')
      if (idx > 0) {
        const key = entry.slice(0, idx).trim()
        const value = entry.slice(idx + 1).trim()
        if (key && value) out[key] = value
      }
    }
  } else if (typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) out[key] = value.trim()
    }
  } else if (typeof raw === 'string' && raw.trim()) {
    const idx = raw.indexOf(':')
    if (idx > 0) {
      const key = raw.slice(0, idx).trim()
      const value = raw.slice(idx + 1).trim()
      if (key && value) out[key] = value
    }
  }
  return Object.keys(out).length ? out : undefined
}

export function normalizeZcMailArchiveListItem(raw: unknown): ZcMailArchiveListItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  const id = asOptionalString(item.id) || asOptionalString(item._id)
  if (!id) return null
  const createdAt =
    asOptionalString(item.createdAt) ||
    (item.createdAt instanceof Date ? item.createdAt.toISOString() : '')
  const tags = parseTags(item.tags)
  return {
    id,
    messageId: asOptionalString(item.messageId),
    sesMessageId: asOptionalString(item.sesMessageId),
    to: asStringArray(item.to),
    from: asOptionalString(item.from),
    subject: asOptionalString(item.subject),
    tenantName: asOptionalString(item.tenantName) || asOptionalString(item.tenant),
    recipient: asOptionalString(item.recipient),
    status: asOptionalString(item.status) || 'unknown',
    createdAt,
    ...(asOptionalString(item.error) ? { error: asOptionalString(item.error) } : {}),
    ...(tags ? { tags } : {})
  }
}

/** zcMail GET /v1/mail/archive/:id responds with `{ item: … }`. */
export function unwrapZcMailArchiveDetailBody(body: unknown): ZcMailArchiveDetail {
  if (!body || typeof body !== 'object') {
    throw new ZcMailSendError('zcMail archive detail response was empty', 0, body)
  }
  const row = body as Record<string, unknown>
  const source = row.item && typeof row.item === 'object' ? row.item : body
  const list = normalizeZcMailArchiveListItem(source)
  if (!list) {
    throw new ZcMailSendError('zcMail archive detail was missing id', 0, body)
  }
  const record = source as Record<string, unknown>
  const events = Array.isArray(record.events)
    ? record.events
        .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
        .map((entry) => ({
          id: asOptionalString(entry.id) || undefined,
          eventType: asOptionalString(entry.eventType) || undefined,
          status: asOptionalString(entry.status) || undefined,
          recipient: asOptionalString(entry.recipient) || undefined,
          subject: asOptionalString(entry.subject) || undefined,
          eventTimestamp: asOptionalString(entry.eventTimestamp) || null,
          createdAt: asOptionalString(entry.createdAt) || undefined,
          smtpResponse: asOptionalString(entry.smtpResponse) || undefined
        }))
    : []
  const previewRaw =
    record.preview && typeof record.preview === 'object'
      ? (record.preview as Record<string, unknown>)
      : null
  return {
    ...list,
    downloadUrl: asOptionalString(record.downloadUrl) || null,
    storageError: asOptionalString(record.storageError) || undefined,
    preview: previewRaw
      ? {
          html: typeof previewRaw.html === 'string' ? previewRaw.html : null,
          text: typeof previewRaw.text === 'string' ? previewRaw.text : null
        }
      : undefined,
    events
  }
}

function asListResult(body: unknown): ZcMailArchiveListResult {
  if (!body || typeof body !== 'object') return { total: 0, items: [] }
  const row = body as Record<string, unknown>
  const rawItems = Array.isArray(row.items) ? row.items : []
  const items = rawItems
    .map((entry) => normalizeZcMailArchiveListItem(entry))
    .filter((entry): entry is ZcMailArchiveListItem => Boolean(entry))
  return {
    total: typeof row.total === 'number' ? row.total : items.length,
    items
  }
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

export async function listZcMailArchive(
  params: {
    baseUrl: string
    apiKey: string
    tenantName: string
    limit?: number
    skip?: number
    q?: string
    campaign?: string
  },
  fetchImpl: typeof fetch = fetch
): Promise<ZcMailArchiveListResult> {
  const baseUrl = normalizeBaseUrl(params.baseUrl)
  const apiKey = String(params.apiKey || '').trim()
  if (!baseUrl || !apiKey) {
    throw new ZcMailSendError('zcMail archive client requires baseUrl and apiKey', 0, null)
  }
  const qs = new URLSearchParams()
  qs.set('limit', String(params.limit ?? ZC_MAIL_ARCHIVE_STATS_PAGE_LIMIT))
  qs.set('skip', String(params.skip ?? 0))
  if (params.tenantName.trim()) qs.set('tenant', params.tenantName.trim())
  if (params.q?.trim()) qs.set('q', params.q.trim())
  if (params.campaign?.trim()) {
    qs.set('campaign', params.campaign.trim())
    qs.set('tag', `campaign:${params.campaign.trim()}`)
  }

  const response = await fetchImpl(`${baseUrl}${ZC_MAIL_ARCHIVE_PATH}?${qs.toString()}`, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'X-API-Key': apiKey
    }
  })
  const body = await parseJsonResponse(response)
  if (!response.ok) {
    throw new ZcMailSendError(
      `zcMail archive list failed (${response.status})`,
      response.status,
      body
    )
  }
  return asListResult(body)
}

export async function getZcMailArchiveById(
  params: {
    baseUrl: string
    apiKey: string
    archiveId: string
  },
  fetchImpl: typeof fetch = fetch
): Promise<ZcMailArchiveDetail> {
  const baseUrl = normalizeBaseUrl(params.baseUrl)
  const apiKey = String(params.apiKey || '').trim()
  const archiveId = String(params.archiveId || '').trim()
  if (!baseUrl || !apiKey || !archiveId) {
    throw new ZcMailSendError(
      'zcMail archive detail requires baseUrl, apiKey, and archiveId',
      0,
      null
    )
  }
  const response = await fetchImpl(
    `${baseUrl}${ZC_MAIL_ARCHIVE_PATH}/${encodeURIComponent(archiveId)}`,
    {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'X-API-Key': apiKey
      }
    }
  )
  const body = await parseJsonResponse(response)
  if (!response.ok) {
    throw new ZcMailSendError(
      `zcMail archive detail failed (${response.status})`,
      response.status,
      body
    )
  }
  return unwrapZcMailArchiveDetailBody(body)
}
