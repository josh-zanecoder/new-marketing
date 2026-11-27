import { getRegistryConnection } from '@server/lib/mongoose'
import {
  isValidMarketingEmail,
  normalizeMarketingEmail
} from '@server/helpers/marketingEmail'

/** Same collection as tenant/worker health docs (`store.ts`). */
const MARKETING_SYNC_HEALTH_COLLECTION = 'marketing_sync_health'

export const MARKETING_SYNC_ALERT_SETTINGS_KEY = 'sync-health-alert-settings'

/** Min gap between emails for the same failure fingerprint. */
export const MARKETING_SYNC_ALERT_COOLDOWN_MS = 60 * 60 * 1000

export type MarketingSyncAlertSettings = {
  alertEmails: string[]
  /** fingerprint → last notified ISO */
  lastNotifyByFingerprint?: Record<string, string>
  updatedAt: string
}

function nowIso(): string {
  return new Date().toISOString()
}

export function parseAlertEmailsInput(raw: unknown): string[] {
  const parts =
    typeof raw === 'string'
      ? raw.split(/[,;\s]+/)
      : Array.isArray(raw)
        ? raw.map((v) => String(v ?? ''))
        : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    const email = normalizeMarketingEmail(part)
    if (!email || !isValidMarketingEmail(email) || seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}

export async function getMarketingSyncAlertEmails(): Promise<string[]> {
  const settings = await getMarketingSyncAlertSettings()
  return settings.alertEmails
}

export async function getMarketingSyncAlertSettings(): Promise<MarketingSyncAlertSettings> {
  const registry = await getRegistryConnection()
  const row = (await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).findOne({
    key: MARKETING_SYNC_ALERT_SETTINGS_KEY
  })) as Record<string, unknown> | null

  const emails = parseAlertEmailsInput(row?.alertEmails)
  const lastNotifyByFingerprint =
    row?.lastNotifyByFingerprint &&
    typeof row.lastNotifyByFingerprint === 'object' &&
    !Array.isArray(row.lastNotifyByFingerprint)
      ? Object.fromEntries(
          Object.entries(row.lastNotifyByFingerprint as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string' && v.trim())
            .map(([k, v]) => [k, String(v)])
        )
      : {}

  return {
    alertEmails: emails,
    lastNotifyByFingerprint,
    updatedAt: typeof row?.updatedAt === 'string' ? row.updatedAt : nowIso()
  }
}

export async function setMarketingSyncAlertEmails(
  emailsInput: unknown
): Promise<MarketingSyncAlertSettings> {
  const alertEmails = parseAlertEmailsInput(emailsInput)
  const registry = await getRegistryConnection()
  const at = nowIso()
  await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).updateOne(
    { key: MARKETING_SYNC_ALERT_SETTINGS_KEY },
    {
      $set: {
        key: MARKETING_SYNC_ALERT_SETTINGS_KEY,
        _kind: 'settings',
        alertEmails,
        updatedAt: at
      },
      $setOnInsert: {
        createdAt: at,
        lastNotifyByFingerprint: {}
      }
    },
    { upsert: true }
  )
  return getMarketingSyncAlertSettings()
}

/** Returns true if this fingerprint is outside cooldown and marks it notified. */
export async function claimMarketingSyncAlertNotifySlot(
  fingerprint: string
): Promise<boolean> {
  const key = String(fingerprint || '')
    .trim()
    .replace(/[.$]/g, '_')
    .slice(0, 200)
  if (!key) return false

  const registry = await getRegistryConnection()
  const at = nowIso()
  const cutoff = new Date(Date.now() - MARKETING_SYNC_ALERT_COOLDOWN_MS).toISOString()
  const path = `lastNotifyByFingerprint.${key}`

  const result = await registry.collection(MARKETING_SYNC_HEALTH_COLLECTION).updateOne(
    {
      key: MARKETING_SYNC_ALERT_SETTINGS_KEY,
      $or: [
        { [path]: { $exists: false } },
        { [path]: null },
        { [path]: { $lt: cutoff } }
      ]
    },
    {
      $set: {
        [path]: at,
        updatedAt: at
      }
    }
  )

  return (result.modifiedCount || 0) > 0
}
