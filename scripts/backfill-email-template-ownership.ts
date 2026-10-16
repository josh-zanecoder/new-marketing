/**
 * One-time: give legacy email templates an owner and split templates linked by campaigns of
 * different owners, so AEs stop seeing (and editing) each other's campaign designs.
 *
 *   npx tsx scripts/backfill-email-template-ownership.ts --db forge_capital_lending_db
 *   npx tsx scripts/backfill-email-template-ownership.ts --db forge_capital_lending_db --apply
 *
 * Options:
 *   --db <name>                 Tenant database (required).
 *   --apply                     Write changes. Without it the script only prints the plan.
 *   --shared-owners a@x,b@y     Campaign owners whose templates stay shared (company/admin users).
 *
 * Rules:
 *   - Templates with `externalId` (CRM-managed) stay shared.
 *   - Owner = owner of the earliest campaign using the template; no campaign => stays shared.
 *   - Every other campaign using an owned template whose owner differs gets its own private copy.
 *     Shared templates stay linked; campaign saves copy them before editing.
 *
 * Env: MONGODB_URI.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import mongoose from 'mongoose'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnv({ path: join(rootDir, '.env') })

type TemplateDoc = {
  _id: mongoose.Types.ObjectId
  name?: string
  externalId?: string
  metadata?: { ownerEmail?: string | null } | null
  [key: string]: unknown
}

type CampaignDoc = {
  _id: mongoose.Types.ObjectId
  name?: string
  emailTemplate: mongoose.Types.ObjectId
  createdAt?: Date
  metadata?: { ownerEmail?: string | null } | null
}

function argValue(flag: string): string {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? String(process.argv[i + 1] ?? '').trim() : ''
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim()
  if (!uri) throw new Error('Missing MONGODB_URI')
  const tenantDb = argValue('--db')
  if (!tenantDb) throw new Error('Missing --db <tenant db name>')
  const apply = process.argv.includes('--apply')
  const sharedOwners = new Set(argValue('--shared-owners').split(',').map(normalizeEmail).filter(Boolean))

  await mongoose.connect(uri, { dbName: tenantDb })
  const db = mongoose.connection.db
  if (!db) throw new Error('No database handle')
  const templates = db.collection<TemplateDoc>('emailtemplates')
  const campaigns = db.collection<CampaignDoc>('campaigns')

  const unowned = await templates
    .find({
      $or: [
        { 'metadata.ownerEmail': { $exists: false } },
        { 'metadata.ownerEmail': null },
        { 'metadata.ownerEmail': '' }
      ]
    })
    .toArray()

  const linkedCampaigns = await campaigns
    .find(
      { emailTemplate: { $in: unowned.map((t) => t._id) } },
      { projection: { _id: 1, name: 1, emailTemplate: 1, createdAt: 1, metadata: 1 } }
    )
    .sort({ createdAt: 1, _id: 1 })
    .toArray()

  const campaignsByTemplate = new Map<string, CampaignDoc[]>()
  for (const c of linkedCampaigns) {
    const key = String(c.emailTemplate)
    const list = campaignsByTemplate.get(key) ?? []
    list.push(c)
    campaignsByTemplate.set(key, list)
  }

  let stamped = 0
  let forked = 0
  let keptShared = 0

  for (const template of unowned) {
    const linked = campaignsByTemplate.get(String(template._id)) ?? []
    const label = `"${template.name ?? ''}" (${String(template._id)})`

    let owner = ''
    if (String(template.externalId ?? '').trim()) {
      console.log(`[shared] ${label}: CRM-managed template`)
    } else if (!linked.length) {
      console.log(`[shared] ${label}: no campaign uses it, owner unknown`)
    } else {
      const firstOwner = normalizeEmail(linked[0]?.metadata?.ownerEmail)
      if (!firstOwner) {
        console.log(`[shared] ${label}: earliest campaign has no owner`)
      } else if (sharedOwners.has(firstOwner)) {
        console.log(`[shared] ${label}: owner ${firstOwner} is in --shared-owners`)
      } else {
        owner = firstOwner
      }
    }

    if (!owner) {
      keptShared++
      continue
    }

    console.log(`[owner]  ${label} -> ${owner}`)
    stamped++
    if (apply) {
      await templates.updateOne({ _id: template._id }, { $set: { 'metadata.ownerEmail': owner } })
    }

    for (const campaign of linked) {
      const campaignOwner = normalizeEmail(campaign.metadata?.ownerEmail)
      if (!campaignOwner || campaignOwner === owner || sharedOwners.has(campaignOwner)) continue
      console.log(
        `[fork]   ${label} -> private copy for campaign "${campaign.name ?? ''}" (${String(campaign._id)}) owned by ${campaignOwner}`
      )
      forked++
      if (!apply) continue
      const { _id, externalId: _externalId, ...rest } = template
      const now = new Date()
      const copy = await templates.insertOne({
        ...rest,
        _id: new mongoose.Types.ObjectId(),
        name: `${campaign.name ?? template.name ?? 'Campaign'} - Template`,
        saveToLibrary: false,
        metadata: { ownerEmail: campaignOwner },
        createdAt: now,
        updatedAt: now
      } as TemplateDoc)
      await campaigns.updateOne(
        { _id: campaign._id },
        { $set: { emailTemplate: copy.insertedId } }
      )
    }
  }

  console.log(
    `\nTenant "${tenantDb}" ${apply ? 'APPLIED' : 'DRY RUN'}: ${unowned.length} unowned templates, ` +
      `${stamped} assigned an owner, ${keptShared} kept shared, ${forked} campaign copies.`
  )
  if (!apply) console.log('Re-run with --apply to write these changes.')

  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
