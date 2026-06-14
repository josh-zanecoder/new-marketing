// BullMQ / Redis connection options from env (Queue + Worker each use their own ioredis connections).
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
    maxRetriesPerRequest: null,
    // Reduce transient "could not renew lock" errors during long batch jobs.
    keepAlive: 30_000,
    connectTimeout: 10_000,
    retryStrategy: (times: number) => Math.min(times * 200, 5_000)
  }
}
