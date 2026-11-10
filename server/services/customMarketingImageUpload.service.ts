import { randomUUID } from 'node:crypto'
import { Storage, type Bucket, type GetFilesResponse } from '@google-cloud/storage'
import {
  buildCustomMarketingGcsObjectPath,
  buildPublicGcsObjectUrl,
  collectCustomMarketingDataImageSrcs,
  extensionForCustomMarketingImageMime,
  parseCustomMarketingImageDataUrl,
  replaceCustomMarketingImageSrc,
  sanitizeCustomMarketingGcsPathSegment,
  type ParsedCustomMarketingImageDataUrl
} from '~~/shared/customMarketingHostedImages'
import { CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES } from '~~/shared/customMarketingEmailSize'
import { isAllowedCustomMarketingImageMime } from '~~/shared/customMarketingEditorOptions'

type GcsEnv = {
  bucketName: string
  projectId: string
  clientEmail: string
  privateKey: string
}

let storageClient: Storage | null = null
let cachedBucketName = ''

function decodeGcsPrivateKey(raw: string, base64Raw: string): string {
  const fromB64 = String(base64Raw ?? '').trim()
  if (fromB64) {
    try {
      return Buffer.from(fromB64, 'base64').toString('utf8').replace(/\\n/g, '\n').trim()
    } catch {
      throw createError({
        statusCode: 500,
        message: 'Invalid GCS_PRIVATE_KEY_BASE64 (could not decode).'
      })
    }
  }
  return String(raw ?? '').replace(/\\n/g, '\n').trim()
}

function readGcsEnv(): GcsEnv {
  const config = useRuntimeConfig()
  const bucketName = String(
    (config.gcsBucket as string) ||
      process.env.GCS_BUCKET ||
      process.env.MARKETING_GCS_BUCKET ||
      process.env.GCP_BUCKET_NAME ||
      ''
  ).trim()
  const projectId = String(
    (config.gcsProjectId as string) ||
      process.env.GCS_PROJECT_ID ||
      process.env.GCP_PROJECT_ID ||
      process.env.CLOUD_TASKS_PROJECT_ID ||
      (config.firebaseProjectId as string) ||
      process.env.FIREBASE_PROJECT_ID ||
      ''
  ).trim()
  const clientEmail = String(
    (config.gcsClientEmail as string) ||
      process.env.GCS_CLIENT_EMAIL ||
      process.env.GCP_CLIENT_EMAIL ||
      (config.firebaseClientEmail as string) ||
      process.env.FIREBASE_CLIENT_EMAIL ||
      ''
  ).trim()
  const privateKey = decodeGcsPrivateKey(
    String(
      (config.gcsPrivateKey as string) ||
        process.env.GCS_PRIVATE_KEY ||
        process.env.GCP_PRIVATE_KEY ||
        (config.firebasePrivateKey as string) ||
        process.env.FIREBASE_PRIVATE_KEY ||
        ''
    ),
    String((config.gcsPrivateKeyBase64 as string) || process.env.GCS_PRIVATE_KEY_BASE64 || '')
  )

  if (!bucketName) {
    throw createError({
      statusCode: 503,
      message:
        'GCS is not configured. Set GCS_BUCKET (or MARKETING_GCS_BUCKET) for Custom Marketing image hosting.'
    })
  }

  return { bucketName, projectId, clientEmail, privateKey }
}

function getGcsBucket(): Bucket {
  const env = readGcsEnv()
  if (!storageClient || cachedBucketName !== env.bucketName) {
    const options: ConstructorParameters<typeof Storage>[0] = {}
    if (env.projectId) options.projectId = env.projectId
    if (env.clientEmail && env.privateKey) {
      options.credentials = {
        client_email: env.clientEmail,
        private_key: env.privateKey
      }
    }
    storageClient = new Storage(options)
    cachedBucketName = env.bucketName
  }
  return storageClient.bucket(env.bucketName)
}

export type UploadCustomMarketingImageInput = {
  tenantName: string
  recipientListId: string
  buffer: Buffer
  contentType: string
}

export type UploadCustomMarketingImageResult = {
  url: string
  objectPath: string
}

/** Upload a photo to GCS under `custom-marketing/{tenant}/{recipientListId}/…`. */
export async function uploadCustomMarketingImageToGcs(
  input: UploadCustomMarketingImageInput
): Promise<UploadCustomMarketingImageResult> {
  const contentType = String(input.contentType ?? '').toLowerCase()
  if (!isAllowedCustomMarketingImageMime(contentType)) {
    throw createError({ statusCode: 400, message: 'Use PNG, JPEG, GIF, or WebP images.' })
  }
  if (!input.buffer.length) {
    throw createError({ statusCode: 400, message: 'Image payload is empty.' })
  }
  if (input.buffer.length > CUSTOM_MARKETING_COMPRESSED_IMAGE_MAX_BYTES * 2) {
    throw createError({
      statusCode: 400,
      message: 'Image is too large after compression. Try a smaller photo.'
    })
  }

  const ext = extensionForCustomMarketingImageMime(contentType)
  const fileName = `${Date.now()}-${randomUUID()}.${ext}`
  const objectPath = buildCustomMarketingGcsObjectPath({
    tenantName: input.tenantName,
    recipientListId: input.recipientListId,
    fileName
  })

  const bucket = getGcsBucket()
  const file = bucket.file(objectPath)
  try {
    await file.save(input.buffer, {
      resumable: false,
      metadata: {
        contentType,
        cacheControl: 'public, max-age=31536000',
        metadata: {
          tenantName: input.tenantName,
          recipientListId: input.recipientListId,
          uploadedAt: new Date().toISOString()
        }
      }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'GCS upload failed'
    const isDenied =
      /Permission|denied|storage\.objects\.create|does not have/i.test(message)
    console.error('Custom Marketing GCS upload failed', message)
    throw createError({
      statusCode: isDenied ? 403 : 502,
      message: isDenied
        ? 'GCS upload denied. Grant the upload service account roles/storage.objectAdmin on bucket custom-marketing-images.'
        : 'Could not upload image to GCS. Check GCS_BUCKET and credentials.'
    })
  }

  try {
    await file.makePublic()
  } catch (err: unknown) {
    // Uniform bucket-level access often blocks makePublic; public IAM on prefix still works.
    console.error(
      'GCS makePublic skipped',
      err instanceof Error ? err.message : 'unknown'
    )
  }

  return {
    url: buildPublicGcsObjectUrl(bucket.name, objectPath),
    objectPath
  }
}

export async function uploadCustomMarketingImageDataUrlToGcs(input: {
  tenantName: string
  recipientListId: string
  dataUrl: string
}): Promise<UploadCustomMarketingImageResult> {
  const parsed = parseCustomMarketingImageDataUrl(input.dataUrl)
  if (!parsed) {
    throw createError({ statusCode: 400, message: 'Invalid image data URL.' })
  }
  return uploadParsedCustomMarketingImageToGcs({
    tenantName: input.tenantName,
    recipientListId: input.recipientListId,
    parsed
  })
}

async function uploadParsedCustomMarketingImageToGcs(input: {
  tenantName: string
  recipientListId: string
  parsed: ParsedCustomMarketingImageDataUrl
}): Promise<UploadCustomMarketingImageResult> {
  return uploadCustomMarketingImageToGcs({
    tenantName: input.tenantName,
    recipientListId: input.recipientListId,
    buffer: Buffer.from(input.parsed.base64, 'base64'),
    contentType: input.parsed.mime
  })
}

export type TenantHostedImageListItem = {
  id: string
  url: string
  objectPath: string
  fileName: string
  contentType: string
  size: number
  createdAt: string
}

const IMAGE_CONTENT_TYPE_RE = /^image\/(png|jpe?g|gif|webp)$/i

/**
 * List hosted image objects under `custom-marketing/{tenant}/…`
 * (library, email-templates, custom-marketing list folders, etc.).
 */
export async function listCustomMarketingTenantImages(
  tenantName: string,
  opts?: { maxResults?: number; folder?: string }
): Promise<TenantHostedImageListItem[]> {
  const tenant = sanitizeCustomMarketingGcsPathSegment(tenantName, 'tenant')
  const folder = opts?.folder
    ? sanitizeCustomMarketingGcsPathSegment(opts.folder, '')
    : ''
  const prefix = folder
    ? `custom-marketing/${tenant}/${folder}/`
    : `custom-marketing/${tenant}/`
  const maxResults = Math.min(500, Math.max(1, opts?.maxResults ?? 300))
  const bucket = getGcsBucket()

  let files: GetFilesResponse[0]
  try {
    ;[files] = await bucket.getFiles({
      prefix,
      maxResults,
      autoPaginate: false
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'GCS list failed'
    console.error('Custom Marketing GCS list failed', message)
    throw createError({
      statusCode: 502,
      message: 'Could not list hosted images. Check GCS_BUCKET and credentials.'
    })
  }

  const items: TenantHostedImageListItem[] = []
  for (const file of files) {
    const objectPath = String(file.name ?? '').trim()
    if (!objectPath || objectPath.endsWith('/')) continue
    const contentType = String(file.metadata?.contentType ?? '').trim()
    if (contentType && !IMAGE_CONTENT_TYPE_RE.test(contentType)) continue
    // Skip unknown types that are clearly not images by extension.
    if (!contentType) {
      if (!/\.(png|jpe?g|gif|webp)$/i.test(objectPath)) continue
    }
    const fileName = objectPath.split('/').pop() || objectPath
    const sizeRaw = file.metadata?.size
    const size =
      typeof sizeRaw === 'string'
        ? Number(sizeRaw) || 0
        : typeof sizeRaw === 'number'
          ? sizeRaw
          : 0
    const createdRaw =
      (typeof file.metadata?.timeCreated === 'string' && file.metadata.timeCreated) ||
      (typeof file.metadata?.updated === 'string' && file.metadata.updated) ||
      ''
    const createdAt = createdRaw || new Date(0).toISOString()
    items.push({
      id: objectPath,
      url: buildPublicGcsObjectUrl(bucket.name, objectPath),
      objectPath,
      fileName,
      contentType: contentType || 'image/jpeg',
      size,
      createdAt
    })
  }

  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  return items
}

/**
 * Delete hosted image objects for a tenant. Paths must stay under
 * `custom-marketing/{tenant}/` (no path escape).
 */
export async function deleteCustomMarketingTenantImages(
  tenantName: string,
  objectPaths: string[]
): Promise<{ deleted: string[]; skipped: string[] }> {
  const tenant = sanitizeCustomMarketingGcsPathSegment(tenantName, 'tenant')
  const prefix = `custom-marketing/${tenant}/`
  const bucket = getGcsBucket()
  const deleted: string[] = []
  const skipped: string[] = []

  const unique = [
    ...new Set(
      objectPaths
        .map((p) => String(p ?? '').trim().replace(/^\/+/, ''))
        .filter(Boolean)
    )
  ].slice(0, 100)

  for (const objectPath of unique) {
    if (!objectPath.startsWith(prefix) || objectPath.includes('..')) {
      skipped.push(objectPath)
      continue
    }
    try {
      await bucket.file(objectPath).delete({ ignoreNotFound: true })
      deleted.push(objectPath)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'GCS delete failed'
      console.error('Custom Marketing GCS delete failed', objectPath, message)
      skipped.push(objectPath)
    }
  }

  return { deleted, skipped }
}

/**
 * Rewrite any remaining `data:image` embeds to hosted GCS HTTPS URLs
 * (Gmail strips base64 images).
 */
export async function rewriteCustomMarketingDataImagesToGcs(
  html: string,
  input: { tenantName: string; recipientListId: string }
): Promise<string> {
  const srcs = collectCustomMarketingDataImageSrcs(html)
  if (!srcs.length) return String(html ?? '')

  let next = String(html ?? '')
  for (const src of srcs) {
    const uploaded = await uploadCustomMarketingImageDataUrlToGcs({
      tenantName: input.tenantName,
      recipientListId: input.recipientListId,
      dataUrl: src
    })
    next = replaceCustomMarketingImageSrc(next, src, uploaded.url)
  }
  return next
}
