export interface CampaignBatchMessageVersion {
  to: { email: string; name?: string }[]
  subject: string
  htmlContent: string
  /** Optional Brevo template params (ratesheet-style); used when batch content is uniform. */
  params?: Record<string, string>
}

export type BrevoBatchMessageVersionPayload = {
  to: { email: string; name?: string }[]
  subject?: string
  htmlContent?: string
  params?: Record<string, string>
}

export function campaignBatchVersionsAreUniform(versions: CampaignBatchMessageVersion[]): boolean {
  if (versions.length <= 1) return true
  const first = versions[0]
  const subject = String(first?.subject ?? '')
  const html = String(first?.htmlContent ?? '')
  return versions.every(
    (v) => String(v.subject ?? '') === subject && String(v.htmlContent ?? '') === html
  )
}

/**
 * Ratesheet-style compaction: when every recipient shares the same rendered subject/html,
 * send them once on the root payload and omit duplicates from each messageVersion.
 */
export function buildCampaignBrevoBatchRequest(versions: CampaignBatchMessageVersion[]): {
  subject: string
  htmlContent: string
  messageVersions: BrevoBatchMessageVersionPayload[]
  uniform: boolean
} {
  const first = versions[0]
  const subject = String(first?.subject ?? '').trim() || '(No subject)'
  const htmlContent = String(first?.htmlContent ?? '').trim() || '<p></p>'
  const uniform = campaignBatchVersionsAreUniform(versions)

  const messageVersions = versions.map((v) => {
    const inner: BrevoBatchMessageVersionPayload = {
      to: v.to.map((r) => ({ email: r.email, ...(r.name ? { name: r.name } : {}) }))
    }
    if (v.params && Object.keys(v.params).length > 0) {
      inner.params = v.params
    }
    if (!uniform) {
      inner.subject = String(v.subject ?? '').trim() || subject
      inner.htmlContent = String(v.htmlContent ?? '').trim() || htmlContent
    }
    return inner
  })

  return { subject, htmlContent, messageVersions, uniform }
}
