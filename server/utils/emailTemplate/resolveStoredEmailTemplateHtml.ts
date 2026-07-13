/**
 * CRM often stores email HTML in cloud/local storage and syncs the ref URL
 * (e.g. https://storage.googleapis.com/.../email-templates/.../template.html).
 * Marketing previews/sends need the fetched markup, not the URL string.
 */

const LOCAL_UPLOAD_PREFIX = '/uploads/email-templates/'

export function isEmailTemplateHtmlStorageRef(htmlTemplate: string): boolean {
  const value = htmlTemplate.trim()
  if (!value) return false
  if (value.startsWith(LOCAL_UPLOAD_PREFIX)) return true
  if (value.startsWith('https://') || value.startsWith('http://')) {
    return value.includes('/email-templates/')
  }
  return false
}

/**
 * If `htmlTemplate` is a storage URL/path, fetch the HTML body.
 * Inline markup is returned unchanged. On fetch failure, returns the original ref
 * so callers can decide whether to fail or keep the pointer.
 */
export async function resolveStoredEmailTemplateHtml(
  htmlTemplate: string,
  options?: { throwOnFetchError?: boolean }
): Promise<string> {
  const raw = String(htmlTemplate ?? '').trim()
  if (!raw || !isEmailTemplateHtmlStorageRef(raw)) return raw

  // Local CRM disk paths are not reachable from Marketing Cloud Run.
  if (raw.startsWith(LOCAL_UPLOAD_PREFIX)) {
    if (options?.throwOnFetchError) {
      throw new Error('Local email template upload path cannot be resolved from Marketing')
    }
    return raw
  }

  try {
    const res = await fetch(raw, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000)
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching email template HTML`)
    }
    const text = await res.text()
    const body = text.trim()
    if (!body) {
      throw new Error('Email template HTML response was empty')
    }
    return body
  } catch (err) {
    if (options?.throwOnFetchError) throw err
    return raw
  }
}
