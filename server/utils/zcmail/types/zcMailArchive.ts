export type ZcMailArchiveListItem = {
  id: string
  messageId: string
  sesMessageId: string
  to: string[]
  from: string
  subject: string
  tenantName: string
  recipient: string
  status: string
  createdAt: string
  error?: string
  tags?: Record<string, string>
}

export type ZcMailArchiveListResult = {
  total: number
  items: ZcMailArchiveListItem[]
}

export type ZcMailArchiveEvent = {
  id?: string
  eventType?: string
  status?: string
  recipient?: string
  subject?: string
  eventTimestamp?: string | null
  createdAt?: string
  smtpResponse?: string
}

export type ZcMailArchiveDetail = ZcMailArchiveListItem & {
  downloadUrl?: string | null
  preview?: { html?: string | null; text?: string | null }
  events?: ZcMailArchiveEvent[]
  storageError?: string
}
