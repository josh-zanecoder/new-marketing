/**
 * One-shot: consume marketing.sync.requested from local Redpanda and upsert contacts.
 * Usage: node --env-file=.env scripts/replay-retail-sync-from-kafka.mjs
 */
import { Kafka } from 'kafkajs'
import mongoose from 'mongoose'

const brokers = (process.env.KAFKA_BROKERS || '127.0.0.1:19092')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const topic = process.env.KAFKA_TOPIC_MARKETING_EVENTS || 'marketing.events'
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const registryDb = process.env.MONGODB_DB_NAME || 'marketing'
const expectedTenantId = '8b670e79-86fe-4769-9941-04b60be12aec'
const expectedDb = 'marketing_db'

async function main() {
  await mongoose.connect(mongoUri, { dbName: registryDb })
  const client = await mongoose.connection.collection('clients').findOne({
    tenantId: expectedTenantId,
  })
  if (!client) throw new Error(`No clients row for tenant ${expectedTenantId}`)
  const tenantDbName = String(client.dbName || expectedDb).trim()
  console.log('[replay] registry client', { tenantId: expectedTenantId, tenantDbName, topic, brokers })

  const tenantConn = await mongoose.createConnection(mongoUri, { dbName: tenantDbName }).asPromise()
  const Contact = tenantConn.collection('contacts')

  const kafka = new Kafka({ clientId: 'replay-retail-sync', brokers })
  const consumer = kafka.consumer({ groupId: `replay-retail-sync-${Date.now()}` })
  await consumer.connect()
  await consumer.subscribe({ topic, fromBeginning: true })

  let processedChunks = 0
  let upserted = 0

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), 20_000)
    consumer
      .run({
        eachMessage: async ({ message }) => {
          const raw = message.value?.toString()
          if (!raw) return
          let parsed
          try {
            parsed = JSON.parse(raw)
          } catch {
            return
          }
          if (parsed?.eventType !== 'marketing.sync.requested') return
          if (String(parsed.tenantId || '') !== expectedTenantId) {
            console.log('[replay] skip other tenant', parsed.tenantId)
            return
          }
          const contacts = Array.isArray(parsed?.payload?.contacts) ? parsed.payload.contacts : []
          const occurredAt = parsed.occurredAt || new Date().toISOString()
          console.log('[replay] chunk', {
            syncId: parsed?.payload?.syncId,
            chunkIndex: parsed?.payload?.chunkIndex,
            chunkCount: parsed?.payload?.chunkCount,
            contactCount: contacts.length,
          })

          for (const c of contacts) {
            const externalId = String(c.externalId || '').trim()
            const email = String(c.email || '').trim().toLowerCase()
            if (!externalId || !email) continue
            const firstName = String(c.firstName || c.name || '').trim()
            const lastName = String(c.lastName || '').trim()
            const status = String(c.status || c.metadata?.status || '').trim()
            await Contact.updateOne(
              { externalId },
              {
                $set: {
                  externalId,
                  tenantId: expectedTenantId,
                  dBname: tenantDbName,
                  email,
                  firstName,
                  lastName,
                  name: `${firstName} ${lastName}`.trim(),
                  phone: c.phone || '',
                  company: c.company || '',
                  address: c.address || {},
                  contactType: c.contactType || 'borrower',
                  status,
                  metadata: c.metadata || {},
                  channel: c.channel ?? null,
                  updatedAt: new Date(occurredAt),
                  deletedAt: null,
                },
                $setOnInsert: {
                  createdAt: new Date(occurredAt),
                },
              },
              { upsert: true },
            )
            upserted += 1
          }
          processedChunks += 1
          if (processedChunks >= 2) {
            clearTimeout(timer)
            resolve(null)
          }
        },
      })
      .catch(reject)
  })

  await consumer.disconnect()
  const count = await Contact.countDocuments({ deletedAt: null })
  console.log('[replay] done', { processedChunks, upserted, contactCount: count })
  await tenantConn.close()
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('[replay] failed', err)
  process.exit(1)
})
