/**
 * One-time: ensure `contactType` is populated, then remove legacy `contactKind` from contact documents.
 *
 *   node --import tsx/esm scripts/migrate-contact-unset-contact-kind.ts
 *   # or: npx tsx scripts/migrate-contact-unset-contact-kind.ts
 *
 * Env: MONGODB_URI, MONGODB_DB_NAME (registry), CONTACT_SEED_DB_NAME or SEED_CONTACTS_TENANT_DB (tenant db name).
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import mongoose from 'mongoose'
import { LAST_RESORT_CONTACT_TYPE_KEY } from '../server/utils/contact/resolveDefaultContactTypeKey'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv({ path: join(rootDir, '.env') })

async function resolveTenantDbName(registryConn: mongoose.Connection): Promise<string> {
  const a = process.env.CONTACT_SEED_DB_NAME?.trim() || process.env.SEED_CONTACTS_TENANT_DB?.trim()
  if (a?.startsWith('mongodb')) {
    throw new Error('Tenant db name must be a short name, not a URL.')
  }
  if (a) return a
  const doc = (await registryConn
    .collection('clients')
    .findOne(
      { dbName: { $exists: true, $nin: [null, ''] } },
      { sort: { createdAt: 1 }, projection: { dbName: 1 } }
    )) as { dbName?: string } | null
  const dbName = doc && typeof doc.dbName === 'string' ? doc.dbName.trim() : ''
  if (!dbName) throw new Error('Set CONTACT_SEED_DB_NAME or SEED_CONTACTS_TENANT_DB')
  return dbName
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim()
  const registryDb = process.env.MONGODB_DB_NAME?.trim() || 'marketing'
  if (!uri) throw new Error('Missing MONGODB_URI')

  await mongoose.connect(uri, { dbName: registryDb })
  const registryConn = mongoose.connection
  const tenantDb = await resolveTenantDbName(registryConn)
  const coll = registryConn.useDb(tenantDb).collection('contacts')

  let updated = 0
  const cursor = coll.find({
    $or: [
      { contactKind: { $exists: true } },
      { contactType: { $exists: false } },
      { contactType: null },
      { contactType: { $size: 0 } }
    ]
  })
  const batch: {
    updateOne: {
      filter: { _id: unknown }
      update: { $set: { contactType: string[] }; $unset: { contactKind: string } }
    }
  }[] = []
  for await (const doc of cursor) {
    const raw = doc as Record<string, unknown>
    const existing = Array.isArray(raw.contactType)
      ? raw.contactType.map((k) => String(k).trim().toLowerCase()).filter(Boolean)
      : []
    const kind = String(raw.contactKind ?? '')
      .trim()
      .toLowerCase()
    const contactType =
      existing.length > 0
        ? [...new Set(existing)]
        : kind
          ? [kind]
          : [LAST_RESORT_CONTACT_TYPE_KEY]
    batch.push({
      updateOne: {
        filter: { _id: raw._id },
        update: { $set: { contactType }, $unset: { contactKind: '' } }
      }
    })
    if (batch.length >= 200) {
      const r = await coll.bulkWrite(batch, { ordered: false })
      updated += r.modifiedCount
      batch.length = 0
    }
  }
  if (batch.length) {
    const r = await coll.bulkWrite(batch, { ordered: false })
    updated += r.modifiedCount
  }
  console.log(`Tenant "${tenantDb}": migrated / touched ${updated} contacts (bulkWrite modifiedCount).`)

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
