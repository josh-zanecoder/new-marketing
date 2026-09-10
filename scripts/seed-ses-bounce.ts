/**
 * Seed Amazon SES mailbox-simulator contacts for bounce / complaint testing.
 *
 *   npm run seed:ses-bounce
 *   npm run seed:ses-bounce -- --clear
 *   npm run seed:ses-bounce -- --db cbc_crm_db
 *   npm run seed:ses-bounce -- --with-events
 *   npm run seed:ses-bounce -- --apply-unsub
 *
 * Env: MONGODB_URI, MONGODB_DB_NAME (registry, default marketing)
 *      CONTACT_SEED_DB_NAME or --db (tenant DB name)
 *
 * SES simulators only work when mail is sent through SES (zcMail).
 * After seeding, add these contacts to a list/campaign and send.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import mongoose from 'mongoose'

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, default: '' },
    unit: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    county: { type: String, default: '' }
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
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    isUnsubscribe: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
)

contactSchema.index({ email: 1 })

const brevoTrackingEventSchema = new mongoose.Schema(
  {
    email: { type: String, default: '', trim: true },
    date: { type: String, required: true, trim: true },
    messageId: { type: String, required: true, trim: true },
    event: { type: String, required: true, trim: true },
    tag: { type: String, default: '', trim: true },
    subject: { type: String, default: '', trim: true },
    from: { type: String, default: '', trim: true },
    ip: { type: String, default: '', trim: true },
    link: { type: String, default: '', trim: true },
    reason: { type: String, default: '', trim: true },
    eventAt: { type: Date, default: null },
    eventKeyAt: { type: Number, default: null },
    campaignId: { type: String, default: '', trim: true },
    userEmail: { type: String, default: '', trim: true, lowercase: true }
  },
  { timestamps: true, collection: 'brevo_tracking_events' }
)

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv({ path: join(rootDir, '.env') })

const SOURCE = 'seed-ses-bounce'
const DEFAULT_DB = 'cbc_crm_db'
const CONTACT_TYPE = 'prospect'

/** Amazon SES mailbox simulators — https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html */
const FIXTURES = [
  {
    key: 'hard-bounce',
    firstName: 'SES',
    lastName: 'HardBounce',
    email: 'bounce@simulator.amazonses.com',
    note: 'Hard bounce — should auto-unsubscribe after send',
    trackingEvent: 'hardBounces' as const,
    reason: 'Permanent bounce (SES mailbox simulator)',
    applyUnsub: true
  },
  {
    key: 'complaint',
    firstName: 'SES',
    lastName: 'Complaint',
    email: 'complaint@simulator.amazonses.com',
    note: 'Complaint / spam — should auto-unsubscribe after send',
    trackingEvent: 'spam' as const,
    reason: 'Complaint (SES mailbox simulator)',
    applyUnsub: true
  },
  {
    key: 'soft-bounce',
    firstName: 'SES',
    lastName: 'SoftBounce',
    email: 'ooto@simulator.amazonses.com',
    note: 'Soft / OOTO — should stay subscribed',
    trackingEvent: 'softBounces' as const,
    reason: 'Out of the office (SES mailbox simulator)',
    applyUnsub: false
  },
  {
    key: 'success',
    firstName: 'SES',
    lastName: 'Success',
    email: 'success@simulator.amazonses.com',
    note: 'Delivered — control contact',
    trackingEvent: 'delivered' as const,
    reason: '',
    applyUnsub: false
  }
] as const

function parseArgs() {
  const argv = process.argv.slice(2)
  let db = process.env.CONTACT_SEED_DB_NAME?.trim() || process.env.SEED_CONTACTS_TENANT_DB?.trim() || DEFAULT_DB
  const clear = argv.includes('--clear')
  const withEvents = argv.includes('--with-events')
  const applyUnsub = argv.includes('--apply-unsub')

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--db' && argv[i + 1]) {
      db = String(argv[++i]).trim()
    }
  }

  if (db.startsWith('mongodb')) {
    console.error('--db must be the database name only (e.g. cbc_crm_db), not a connection URL.')
    process.exit(1)
  }

  return { db, clear, withEvents, applyUnsub }
}

function contactModel(conn: mongoose.Connection) {
  return conn.models.Contact || conn.model('Contact', contactSchema)
}

function trackingModel(conn: mongoose.Connection) {
  return (
    conn.models.BrevoTrackingEvent ||
    conn.model('BrevoTrackingEvent', brevoTrackingEventSchema)
  )
}

async function resolveTenantDbName(
  registryConn: mongoose.Connection,
  fromArgs: string
): Promise<string> {
  if (fromArgs && fromArgs !== DEFAULT_DB) {
    console.log(`Using tenant database "${fromArgs}" (--db / env)`)
    return fromArgs
  }
  if (process.env.CONTACT_SEED_DB_NAME?.trim() || process.env.SEED_CONTACTS_TENANT_DB?.trim()) {
    console.log(`Using tenant database "${fromArgs}" (env)`)
    return fromArgs
  }

  const doc = (await registryConn.collection('clients').findOne(
    { dbName: { $exists: true, $nin: [null, ''] } },
    { sort: { createdAt: 1 }, projection: { dbName: 1, name: 1 } }
  )) as { dbName?: string; name?: string } | null

  const dbName =
    doc && typeof doc.dbName === 'string' && doc.dbName.trim() ? doc.dbName.trim() : fromArgs
  const label = typeof doc?.name === 'string' && doc.name ? ` (${doc.name})` : ''
  console.log(`Using tenant database "${dbName}"${label}`)
  return dbName
}

function buildContactDocs() {
  return FIXTURES.map((f) => ({
    contactType: [CONTACT_TYPE],
    firstName: f.firstName,
    lastName: f.lastName,
    email: f.email,
    phone: '',
    company: 'SES Simulator',
    channel: 'email',
    address: { street: '', city: '', state: '', county: '' },
    source: SOURCE,
    externalId: `${SOURCE}-${f.key}`,
    metadata: {
      seed: true,
      sesSimulator: f.key,
      note: f.note
    },
    isUnsubscribe: false,
    deletedAt: null
  }))
}

async function main() {
  const args = parseArgs()
  const uri = process.env.MONGODB_URI?.trim()
  const registryDb = process.env.MONGODB_DB_NAME?.trim() || 'marketing'

  if (!uri) {
    console.error('Missing MONGODB_URI in new-marketing/.env')
    process.exit(1)
  }

  await mongoose.connect(uri, { dbName: registryDb })
  const registryConn = mongoose.connection
  const tenantDb = await resolveTenantDbName(registryConn, args.db)
  const tenantConn = registryConn.useDb(tenantDb)
  const Contact = contactModel(tenantConn)
  const BrevoTrackingEvent = trackingModel(tenantConn)

  if (args.clear) {
    const clearedContacts = await Contact.deleteMany({ source: SOURCE })
    const clearedEvents = await BrevoTrackingEvent.deleteMany({
      messageId: { $regex: `^${SOURCE}-` }
    })
    console.log(
      `Cleared ${clearedContacts.deletedCount} contacts (source=${SOURCE}) and ${clearedEvents.deletedCount} tracking events`
    )
  }

  const docs = buildContactDocs()
  let inserted = 0
  let updated = 0

  for (const doc of docs) {
    // Replace whole `metadata` (do not $unset nested keys in the same update —
    // Mongo rejects conflicting paths under `metadata`).
    const res = await Contact.updateOne(
      { source: SOURCE, externalId: doc.externalId },
      {
        $set: {
          ...doc,
          // Keep subscribed unless --apply-unsub runs below
          isUnsubscribe: false
        }
      },
      { upsert: true }
    )
    if (res.upsertedCount) inserted += 1
    else if (res.modifiedCount) updated += 1
  }

  console.log(`Contacts upserted into "${tenantDb}": ${inserted} inserted, ${updated} updated`)
  for (const f of FIXTURES) {
    console.log(`  - ${f.email}  (${f.note})`)
  }

  if (args.withEvents) {
    const now = new Date()
    const iso = now.toISOString()
    let eventUpserts = 0
    for (const f of FIXTURES) {
      const messageId = `${SOURCE}-${f.key}-${now.getTime()}`
      await BrevoTrackingEvent.updateOne(
        { messageId, event: f.trackingEvent },
        {
          $set: {
            email: f.email,
            date: iso,
            messageId,
            event: f.trackingEvent,
            tag: `db:${tenantDb}|source:${SOURCE}`,
            subject: 'SES bounce seed',
            from: '',
            reason: f.reason,
            eventAt: now,
            eventKeyAt: now.getTime(),
            campaignId: '',
            userEmail: ''
          }
        },
        { upsert: true }
      )
      eventUpserts += 1
    }
    console.log(`Tracking events upserted: ${eventUpserts} (hard bounce / spam / soft / delivered)`)
  }

  if (args.applyUnsub) {
    let unsubbed = 0
    for (const f of FIXTURES.filter((x) => x.applyUnsub)) {
      const r = await Contact.updateOne(
        { source: SOURCE, email: f.email, deletedAt: null },
        {
          $set: {
            isUnsubscribe: true,
            'metadata.unsubscribeSource': f.trackingEvent,
            'metadata.unsubscribeAt': new Date().toISOString(),
            'metadata.bounceMessageId': `${SOURCE}-${f.key}-applied`
          }
        }
      )
      unsubbed += r.modifiedCount
    }
    console.log(
      `Applied unsubscribe to ${unsubbed} contact(s) (bounce + complaint). Soft/success left subscribed.`
    )
  } else {
    console.log(
      'Contacts left subscribed. Send a campaign to them via zcMail/SES, or re-run with --apply-unsub to simulate webhook side effects.'
    )
  }

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
