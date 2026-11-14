import {
  uploadCustomMarketingImageToGcs,
  rewriteCustomMarketingDataImagesToGcs
} from '@server/services/customMarketingImageUpload.service'
import { CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES } from '~~/shared/customMarketingEmailSize'
import { isAllowedCustomMarketingImageMime } from '~~/shared/customMarketingEditorOptions'
import {
  CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
  htmlContainsCustomMarketingDataImages,
  replaceCustomMarketingImageSrc
} from '~~/shared/customMarketingHostedImages'
import {
  planEmailTemplateHostableImages
} from '~~/shared/utils/emailTemplateHostableImages'
import type { HostedImageOwnership } from '~~/shared/hostedImageAccess'

const REMOTE_FETCH_TIMEOUT_MS = 15_000
const REMOTE_FETCH_MAX_BYTES = CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES * 2

export type RewriteEmailTemplateImagesResult = {
  html: string
  hostedCount: number
  skippedRemoteCount: number
  skippedUnsupportedCount: number
}

function mimeFromResponse(contentType: string, url: string): string | null {
  const raw = String(contentType ?? '').split(';')[0]?.trim().toLowerCase() || ''
  if (isAllowedCustomMarketingImageMime(raw)) return raw
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase()
    } catch {
      return ''
    }
  })()
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.gif')) return 'image/gif'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  return null
}

async function fetchRemoteImageBuffer(
  url: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { Accept: 'image/*,*/*;q=0.8' }
    })
    if (!res.ok) return null
    const contentType = mimeFromResponse(res.headers.get('content-type') || '', url)
    if (!contentType) return null
    const lenHeader = Number(res.headers.get('content-length') || 0)
    if (Number.isFinite(lenHeader) && lenHeader > REMOTE_FETCH_MAX_BYTES) return null
    const ab = await res.arrayBuffer()
    if (ab.byteLength <= 0 || ab.byteLength > REMOTE_FETCH_MAX_BYTES) return null
    return { buffer: Buffer.from(ab), contentType }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Host embedded + remote `<img>` assets into the tenant Images library (`…/library/…`)
 * so uploaded email HTML keeps working when sent (Gmail needs HTTPS hosted images).
 */
export async function rewriteEmailTemplateImagesForHosting(
  html: string,
  input: { tenantName: string; ownership?: HostedImageOwnership }
): Promise<RewriteEmailTemplateImagesResult> {
  const tenantName = String(input.tenantName ?? '').trim()
  let next = String(html ?? '')
  let hostedCount = 0
  const plan = planEmailTemplateHostableImages(next)

  if (htmlContainsCustomMarketingDataImages(next)) {
    if (!tenantName) {
      throw createError({
        statusCode: 400,
        message: 'Photos must be hosted for email clients. Configure GCS tenant credentials.'
      })
    }
    const before = next
    next = await rewriteCustomMarketingDataImagesToGcs(next, {
      tenantName,
      recipientListId: CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
      ownership: input.ownership
    })
    if (next !== before) {
      hostedCount += plan.dataUrls.length
    }
  }

  let skippedRemoteCount = 0
  if (tenantName && plan.remoteUrls.length) {
    for (const remoteUrl of plan.remoteUrls) {
      if (!next.includes(remoteUrl)) continue
      const fetched = await fetchRemoteImageBuffer(remoteUrl)
      if (!fetched) {
        skippedRemoteCount += 1
        continue
      }
      try {
        const uploaded = await uploadCustomMarketingImageToGcs({
          tenantName,
          recipientListId: CUSTOM_MARKETING_GCS_LIBRARY_FOLDER,
          buffer: fetched.buffer,
          contentType: fetched.contentType,
          ownership: input.ownership
        })
        next = replaceCustomMarketingImageSrc(next, remoteUrl, uploaded.url)
        hostedCount += 1
      } catch {
        skippedRemoteCount += 1
      }
    }
  }

  return {
    html: next,
    hostedCount,
    skippedRemoteCount,
    skippedUnsupportedCount: plan.skipped.length
  }
}
