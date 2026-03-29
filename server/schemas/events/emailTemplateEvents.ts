export const EMAIL_TEMPLATE_EVENT_TYPES = {
  CREATED: 'marketing.email_template.created',
  UPDATED: 'marketing.email_template.updated',
  DELETED: 'marketing.email_template.deleted'
} as const

export type EmailTemplateEventType =
  (typeof EMAIL_TEMPLATE_EVENT_TYPES)[keyof typeof EMAIL_TEMPLATE_EVENT_TYPES]

/** Payload for create / update (upsert) events. */
export type EmailTemplateUpsertPayload = {
  externalId: string
  name: string
  subject: string
  htmlTemplate: string
  description: string
}

export type EmailTemplateUpsertEventEnvelope = {
  eventType:
    | typeof EMAIL_TEMPLATE_EVENT_TYPES.CREATED
    | typeof EMAIL_TEMPLATE_EVENT_TYPES.UPDATED
  occurredAt: string
  tenantId: string
  dBname: string
  payload: EmailTemplateUpsertPayload
}

export type EmailTemplateDeletedPayload = {
  externalId: string
}

export type EmailTemplateDeletedEventEnvelope = {
  eventType: typeof EMAIL_TEMPLATE_EVENT_TYPES.DELETED
  occurredAt: string
  tenantId: string
  dBname: string
  payload: EmailTemplateDeletedPayload
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Accept missing `occurredAt` for older producers; normalized on the envelope. */
function normalizeOccurredAt(raw: unknown): string {
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  return new Date().toISOString()
}

function parseUpsertPayload(raw: Record<string, unknown>): EmailTemplateUpsertPayload | null {
  if (typeof raw.externalId !== 'string' || !raw.externalId.trim()) return null
  if (typeof raw.name !== 'string' || !raw.name.trim()) return null
  if (typeof raw.subject !== 'string' || !raw.subject.trim()) return null
  if (typeof raw.htmlTemplate !== 'string' || !raw.htmlTemplate.trim()) return null
  const description = typeof raw.description === 'string' ? raw.description : ''
  return {
    externalId: raw.externalId.trim(),
    name: raw.name.trim(),
    subject: raw.subject.trim(),
    htmlTemplate: raw.htmlTemplate,
    description
  }
}

function parseEmailTemplateUpsertEventEnvelope(
  input: unknown,
  kind:
    | typeof EMAIL_TEMPLATE_EVENT_TYPES.CREATED
    | typeof EMAIL_TEMPLATE_EVENT_TYPES.UPDATED
): EmailTemplateUpsertEventEnvelope | null {
  if (!isObject(input)) return null
  if (input.eventType !== kind) return null
  if (typeof input.tenantId !== 'string' || !input.tenantId.trim()) return null
  if (typeof input.dBname !== 'string') return null
  if (!isObject(input.payload)) return null
  const payload = parseUpsertPayload(input.payload)
  if (!payload) return null
  return {
    eventType: kind,
    occurredAt: normalizeOccurredAt(input.occurredAt),
    tenantId: input.tenantId.trim(),
    dBname: input.dBname,
    payload
  }
}

export function parseEmailTemplateCreatedEventEnvelope(
  input: unknown
): EmailTemplateUpsertEventEnvelope | null {
  return parseEmailTemplateUpsertEventEnvelope(input, EMAIL_TEMPLATE_EVENT_TYPES.CREATED)
}

export function parseEmailTemplateUpdatedEventEnvelope(
  input: unknown
): EmailTemplateUpsertEventEnvelope | null {
  return parseEmailTemplateUpsertEventEnvelope(input, EMAIL_TEMPLATE_EVENT_TYPES.UPDATED)
}

export function parseEmailTemplateDeletedEventEnvelope(
  input: unknown
): EmailTemplateDeletedEventEnvelope | null {
  if (!isObject(input)) return null
  if (input.eventType !== EMAIL_TEMPLATE_EVENT_TYPES.DELETED) return null
  if (typeof input.tenantId !== 'string' || !input.tenantId.trim()) return null
  if (typeof input.dBname !== 'string') return null
  if (!isObject(input.payload)) return null
  const p = input.payload
  if (typeof p.externalId !== 'string' || !p.externalId.trim()) return null
  return {
    eventType: EMAIL_TEMPLATE_EVENT_TYPES.DELETED,
    occurredAt: normalizeOccurredAt(input.occurredAt),
    tenantId: input.tenantId.trim(),
    dBname: input.dBname,
    payload: { externalId: p.externalId.trim() }
  }
}
