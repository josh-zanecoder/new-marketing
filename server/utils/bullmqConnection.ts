import type { ConnectionOptions } from 'bullmq'

/** Options object so BullMQ creates its own ioredis connections (required for Queue + Worker). */
export function getBullMqConnectionOptions(): ConnectionOptions {
  const password = (process.env.REDIS_PASSWORD || '').trim()
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    username: password ? (process.env.REDIS_USERNAME || 'default') : undefined,
    password: password || undefined,
    db: Number(process.env.REDIS_DB) || 0,
    maxRetriesPerRequest: null
  }
}
