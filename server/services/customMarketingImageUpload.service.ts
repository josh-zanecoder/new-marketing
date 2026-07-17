import { randomUUID } from 'node:crypto'
import { Storage, type Bucket } from '@google-cloud/storage'
import {
  buildCustomMarketingGcsObjectPath,
  buildPublicGcsObjectUrl,
  collectCustomMarketingDataImageSrcs,
  extensionForCustomMarketingImageMime,
  parseCustomMarketingImageDataUrl,
  replaceCustomMarketingImageSrc,
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
      ''
  ).trim()
  const projectId = String(
    (config.gcsProjectId as string) ||
      process.env.GCS_PROJECT_ID ||
      process.env.CLOUD_TASKS_PROJECT_ID ||
      (config.firebaseProjectId as string) ||
      process.env.FIREBASE_PROJECT_ID ||
      ''
  ).trim()
  const clientEmail = String(
    (config.gcsClientEmail as string) ||
      process.env.GCS_CLIENT_EMAIL ||
      (config.firebaseClientEmail as string) ||
      process.env.FIREBASE_CLIENT_EMAIL ||
      ''
  ).trim()
  const privateKey = decodeGcsPrivateKey(
    String(
      (config.gcsPrivateKey as string) ||
        process.env.GCS_PRIVATE_KEY ||
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
