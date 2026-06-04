/**
 * Seed marketable prospect contacts with Mailinator emails (load / campaign testing).
 *
 *   npm run seed:mailinator-prospects
 *   npm run seed:mailinator-prospects -- --clear
 *   npm run seed:mailinator-prospects -- --count 5000 --db cbc_crm_db
 *
 * Env: MONGODB_URI, MONGODB_DB_NAME (registry, default marketing)
 *      CONTACT_SEED_DB_NAME or --db (tenant, default cbc_crm_db)
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import mongoose from 'mongoose'

/** Standalone copies for CLI (server models use `@server/` aliases). */
const addressSchema = new mongoose.Schema(
  {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    county: { type: String, default: '' }
  },
  { _id: false }
)

const contactProfileSchema = new mongoose.Schema(
  {
    typeKey: { type: String, trim: true, lowercase: true, default: '' },
    subtypeKeys: { type: [{ type: String, trim: true, lowercase: true }], default: () => [] }
  },
  { _id: false }
)

const contactSchema = new mongoose.Schema(
  {
    externalId: { type: String, default: '' },
    source: { type: String, default: '' },
    contactType: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: () => []
    },
    firstName: { type: String, required: true, trim: true, default: '' },
    lastName: { type: String, required: true, trim: true, default: '' },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    address: { type: addressSchema, default: () => ({}) },
    company: { type: String, default: '', trim: true },
    channel: { type: String, default: 'email', trim: true },
    status: { type: String, default: '', trim: true },
    stage: { type: String, default: '', trim: true },
    contactProfile: { type: contactProfileSchema, default: undefined },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    isUnsubscribe: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

contactSchema.index({ email: 1 })

const contactTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true, collection: 'contact_types' }
)

contactTypeSchema.index({ key: 1 }, { unique: true })

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv({ path: join(rootDir, '.env') })

const SOURCE = 'seed-mailinator-prospect'
const DEFAULT_DB = 'cbc_crm_db'
const DEFAULT_COUNT = 5000
const BATCH_SIZE = 500
const CONTACT_TYPE = 'prospect'

function parseArgs() {
  const argv = process.argv.slice(2)
  let db = process.env.CONTACT_SEED_DB_NAME?.trim() || DEFAULT_DB
  let count = DEFAULT_COUNT
  const clear = argv.includes('--clear')

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--db' && argv[i + 1]) {
      db = String(argv[++i]).trim()
    }
    if (argv[i] === '--count' && argv[i + 1]) {
      const n = Number(argv[++i])
      if (Number.isFinite(n) && n > 0) count = Math.floor(n)
    }
  }

  if (db.startsWith('mongodb')) {
    console.error('--db must be the database name only (e.g. cbc_crm_db), not a connection URL.')
    process.exit(1)
  }

  return { db, count, clear }
}

function contactModel(conn: mongoose.Connection) {
  return conn.models.Contact || conn.model('Contact', contactSchema)
}

function contactTypeModel(conn: mongoose.Connection) {
  return conn.models.ContactType || conn.model('ContactType', contactTypeSchema)
}

function padIndex(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

function buildProspectDocs(count: number) {
  const width = Math.max(5, String(count).length)
  const docs: Record<string, unknown>[] = []
  for (let i = 1; i <= count; i++) {
    const tag = padIndex(i, width)
    docs.push({
      contactType: [CONTACT_TYPE],
      firstName: 'Prospect',
      lastName: tag,
      email: `cbc-prospect-${tag}@mailinator.com`,
      phone: '',
      company: 'Seed Co',
      channel: 'email',
      address: { street: '', city: '', state: '', county: '' },
      source: SOURCE,
      externalId: `${SOURCE}-${tag}`,
      metadata: { seed: true, index: i },
      isUnsubscribe: false,
      deletedAt: null,
      contactProfile: { typeKey: CONTACT_TYPE, subtypeKeys: [] }
    })
  }
  return docs
}

async function ensureProspectContactType(
  ContactType: mongoose.Model<Record<string, unknown>>
): Promise<void> {
  await ContactType.updateOne(
    { key: CONTACT_TYPE },
    {
      $setOnInsert: { key: CONTACT_TYPE, label: 'Prospect', enabled: true, sortOrder: 10 }
    },
    { upsert: true }
  )
}

async function main() {
  const { db: tenantDb, count, clear } = parseArgs()
  const uri = process.env.MONGODB_URI?.trim()
  const registryDb = process.env.MONGODB_DB_NAME?.trim() || 'marketing'

  if (!uri) {
    console.error('Missing MONGODB_URI in new-marketing/.env')
    process.exit(1)
  }

  console.log(`Tenant database: ${tenantDb}`)
  console.log(`Contacts to insert: ${count} (${CONTACT_TYPE}, @mailinator.com)`)

  await mongoose.connect(uri, { dbName: registryDb })
  const registryConn = mongoose.connection
  const tenantConn = registryConn.useDb(tenantDb)
  const Contact = contactModel(tenantConn)
  const ContactType = contactTypeModel(tenantConn)

  await ensureProspectContactType(ContactType)
  console.log(`Ensured contact_types key "${CONTACT_TYPE}"`)

  if (clear) {
    const r = await Contact.deleteMany({ source: SOURCE })
    console.log(`Cleared ${r.deletedCount} contacts where source=${SOURCE}`)
  }

  const existing = await Contact.countDocuments({ source: SOURCE })
  if (existing > 0 && !clear) {
    console.warn(
      `Found ${existing} existing ${SOURCE} contacts. Run with --clear to replace, or use a different --count/db.`
    )
  }

  const docs = buildProspectDocs(count)
  let inserted = 0
  const started = Date.now()

  for (let offset = 0; offset < docs.length; offset += BATCH_SIZE) {
    const batch = docs.slice(offset, offset + BATCH_SIZE)
    try {
      const res = await Contact.insertMany(batch, { ordered: false })
      inserted += res.length
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'insertedDocs' in err) {
        const bulk = err as { insertedDocs?: unknown[]; writeErrors?: unknown[] }
        inserted += bulk.insertedDocs?.length ?? 0
        const writeErrors = Array.isArray(bulk.writeErrors) ? bulk.writeErrors.length : 0
        if (writeErrors > 0) {
          console.warn(`Batch ${offset / BATCH_SIZE + 1}: ${writeErrors} duplicate or failed rows (skipped)`)
        }
      } else {
        throw err
      }
    }
    const pct = Math.min(100, Math.round(((offset + batch.length) / docs.length) * 100))
    process.stdout.write(`\rInserted ${inserted}/${count} (${pct}%)`)
  }

  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s — ${inserted} contacts in "${tenantDb}"`)
  console.log(`Sample email: cbc-prospect-${padIndex(1, Math.max(5, String(count).length))}@mailinator.com`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
