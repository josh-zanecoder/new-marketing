/**
 * Seed sample contacts into a tenant DB (`useDb` on the same cluster as the registry).
 *
 *   npm run seed:contacts
 *   npm run seed:contacts -- --clear
 *
 * Loads `.env` from the project root (next to package.json), so MONGODB_URI is set.
 *
 * Tenant DB (first match): CONTACT_SEED_DB_NAME → SEED_CONTACTS_TENANT_DB → first registry client.
 * Use only the DB name (e.g. sistar_db), NOT the full mongodb+srv:// URL (that goes in MONGODB_URI).
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import mongoose from 'mongoose'
import { contactSchema } from '../server/models/tenant/Contact'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv({ path: join(rootDir, '.env') })

const FIXTURES = [
  {
    contactType: ['prospect'],
    firstName: 'Alex',
    lastName: 'Rivera',
    email: 'alex.rivera@example.com',
    phone: '+1 555-0101',
    company: 'Northwind Labs',
    channel: 'email',
    address: { street: '100 Market St', city: 'San Francisco', state: 'CA', county: 'San Francisco' },
    source: 'seed',
    externalId: 'seed-prospect-1',
    metadata: { segment: 'inbound', score: 42 }
  },
  {
    contactType: ['client'],
    firstName: 'Jordan',
    lastName: 'Lee',
    email: 'jordan.lee@example.com',
    phone: '+1 555-0102',
    company: 'Contoso Realty',
    channel: 'email',
    address: { street: '22 Oak Ave', city: 'Austin', state: 'TX', county: 'Travis' },
    source: 'seed',
    externalId: 'seed-client-1',
    metadata: { tier: 'gold' }
  },
  {
    contactType: ['contact'],
    firstName: 'Sam',
    lastName: 'Taylor',
    email: 'sam.taylor@example.com',
    phone: '',
    company: '',
    channel: 'linkedin',
    address: { street: '', city: 'Denver', state: 'CO', county: 'Denver' },
    source: 'seed',
    externalId: 'seed-contact-1',
    metadata: { note: 'Generic contact row' }
  },
  {
    contactType: ['prospect', 'referral'],
    firstName: 'Riley',
    lastName: 'Chen',
    email: 'riley.chen@example.com',
    phone: '+1 555-0104',
    company: 'Fabrikam Design',
    channel: 'sms',
    address: { street: '5 Harbor Rd', city: 'Boston', state: 'MA', county: 'Suffolk' },
    source: 'seed',
    externalId: 'seed-prospect-2',
    metadata: {}
  }
]

function contactModel(conn: mongoose.Connection) {
  return conn.models.Contact || conn.model('Contact', contactSchema)
}

async function resolveTenantDbName(registryConn: mongoose.Connection): Promise<string> {
  const a = process.env.CONTACT_SEED_DB_NAME?.trim()
  if (a?.startsWith('mongodb')) {
    console.error(
      'CONTACT_SEED_DB_NAME must be only the database name (e.g. sistar_db), not the connection URL. Put the URL in MONGODB_URI in .env.'
    )
    process.exit(1)
  }
  if (a) {
    console.log(`Using tenant database "${a}" (CONTACT_SEED_DB_NAME)`)
    return a
  }

  const b = process.env.SEED_CONTACTS_TENANT_DB?.trim()
  if (b) {
    console.log(`Using tenant database "${b}" (SEED_CONTACTS_TENANT_DB)`)
    return b
  }

  const doc = (await registryConn
    .collection('clients')
    .findOne(
      { dbName: { $exists: true, $nin: [null, ''] } },
      { sort: { createdAt: 1 }, projection: { dbName: 1, name: 1 } }
    )) as { dbName?: string; name?: string } | null

  const dbName =
    doc && typeof doc.dbName === 'string' && doc.dbName.trim() ? doc.dbName.trim() : ''
  if (!dbName) {
    throw new Error(
      'No tenant DB: add SEED_CONTACTS_TENANT_DB=sistar_db to .env, or register a tenant in Admin.'
    )
  }
  const label = typeof doc.name === 'string' && doc.name ? ` (${doc.name})` : ''
  console.log(`Using tenant database "${dbName}"${label} (registry)`)
  return dbName
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim()
  const registryDb = process.env.MONGODB_DB_NAME?.trim() || 'marketing'

  if (!uri) {
    console.error(
      'Missing MONGODB_URI. Add it to new-marketing/.env and run from that folder: npm run seed:contacts'
    )
    process.exit(1)
  }

  const clear = process.argv.includes('--clear')

  await mongoose.connect(uri, { dbName: registryDb })
  const registryConn = mongoose.connection
  const tenantDb = await resolveTenantDbName(registryConn)
  const tenantConn = registryConn.useDb(tenantDb)
  const Contact = contactModel(tenantConn)

  if (clear) {
    const r = await Contact.deleteMany({ source: 'seed' })
    console.log(`Cleared ${r.deletedCount} contacts where source=seed`)
  }

  const docs = FIXTURES.map((d) => ({
    ...d,
    clientId: '',
    deletedAt: null
  }))

  const res = await Contact.insertMany(docs, { ordered: false })
  console.log(`Inserted ${res.length} contacts into db "${tenantDb}"`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
