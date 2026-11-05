import { replaceCustomMarketingImageSrc } from '../customMarketingHostedImages'
import { planEmailTemplateHostableImages } from './emailTemplateHostableImages'

export type HostUploadedEmailTemplateImagesResult = {
  html: string
  hostedCount: number
  failedCount: number
  skippedUnsupportedCount: number
}

/**
 * Client-side assist after HTML file upload: push hostable images into the Images
 * library and rewrite `src` to public HTTPS URLs for preview before save.
 * Server save still rewrites again as the durable path.
 */
export async function hostUploadedEmailTemplateImages(params: {
  html: string
  uploadDataUrl: (dataUrl: string) => Promise<string>
  /** Optional: fetch remote URL → data URL (browser may fail CORS). */
  fetchRemoteAsDataUrl?: (url: string) => Promise<string | null>
}): Promise<HostUploadedEmailTemplateImagesResult> {
  let html = String(params.html ?? '')
  const plan = planEmailTemplateHostableImages(html)
  let hostedCount = 0
  let failedCount = 0

  for (const dataUrl of plan.dataUrls) {
    if (!html.includes(dataUrl)) continue
    try {
      const hostedUrl = String(await params.uploadDataUrl(dataUrl) ?? '').trim()
      if (!hostedUrl) {
        failedCount += 1
        continue
      }
      html = replaceCustomMarketingImageSrc(html, dataUrl, hostedUrl)
      hostedCount += 1
    } catch {
      failedCount += 1
    }
  }

  if (params.fetchRemoteAsDataUrl) {
    for (const remoteUrl of plan.remoteUrls) {
      if (!html.includes(remoteUrl)) continue
      try {
        const dataUrl = await params.fetchRemoteAsDataUrl(remoteUrl)
        if (!dataUrl) {
          failedCount += 1
          continue
        }
        const hostedUrl = String(await params.uploadDataUrl(dataUrl) ?? '').trim()
        if (!hostedUrl) {
          failedCount += 1
          continue
        }
        html = replaceCustomMarketingImageSrc(html, remoteUrl, hostedUrl)
        hostedCount += 1
      } catch {
        failedCount += 1
      }
    }
  }

  return {
    html,
    hostedCount,
    failedCount,
    skippedUnsupportedCount: plan.skipped.length
  }
}

/** Best-effort browser fetch of a remote image as a data URL (CORS permitting). */
export async function fetchRemoteImageAsDataUrlInBrowser(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/') || blob.size <= 0) return null
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : null
        resolve(result && result.startsWith('data:image/') ? result : null)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
