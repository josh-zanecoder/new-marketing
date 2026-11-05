import {
  collectCustomMarketingDataImageSrcs,
  htmlContainsCustomMarketingDataImages,
  replaceCustomMarketingImageSrc
} from '../customMarketingHostedImages'
import { listEmailTemplateHtmlImages } from './emailTemplateHtmlImages'

export { htmlContainsCustomMarketingDataImages, replaceCustomMarketingImageSrc }

/** Already on our public GCS custom-marketing hosting (library or campaign folders). */
export function isEmailTemplateAlreadyHostedImageUrl(src: string): boolean {
  const raw = String(src ?? '').trim()
  if (!raw) return false
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    if (!/storage\.googleapis\.com$/i.test(u.hostname)) return false
    return u.pathname.includes('/custom-marketing/')
  } catch {
    return false
  }
}

export function isEmailTemplateRemoteHttpImageUrl(src: string): boolean {
  const raw = String(src ?? '').trim()
  if (!raw || /^data:/i.test(raw) || /^cid:/i.test(raw)) return false
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export type EmailTemplateHostableImagePlan = {
  dataUrls: string[]
  remoteUrls: string[]
  skipped: Array<{ src: string; reason: string }>
}

/**
 * Classify `<img src>` values for auto-hosting on HTML upload/save.
 * Relative / cid: cannot be hosted from HTML alone.
 */
export function planEmailTemplateHostableImages(html: string): EmailTemplateHostableImagePlan {
  const dataUrls = collectCustomMarketingDataImageSrcs(html)
  const remoteUrls: string[] = []
  const skipped: Array<{ src: string; reason: string }> = []
  const seenRemote = new Set<string>()

  for (const img of listEmailTemplateHtmlImages(html)) {
    const src = String(img.src ?? '').trim()
    if (!src) {
      skipped.push({ src: '', reason: 'missing-src' })
      continue
    }
    if (/^data:image\//i.test(src)) continue
    if (/^cid:/i.test(src)) {
      skipped.push({ src, reason: 'cid' })
      continue
    }
    if (isEmailTemplateAlreadyHostedImageUrl(src)) continue
    if (isEmailTemplateRemoteHttpImageUrl(src)) {
      if (seenRemote.has(src)) continue
      seenRemote.add(src)
      remoteUrls.push(src)
      continue
    }
    skipped.push({ src, reason: 'relative-or-unsupported' })
  }

  return { dataUrls, remoteUrls, skipped }
}

export function emailTemplateHtmlNeedsImageHosting(html: string): boolean {
  const plan = planEmailTemplateHostableImages(html)
  return plan.dataUrls.length > 0 || plan.remoteUrls.length > 0
}
