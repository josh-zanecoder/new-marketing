// BullMQ / Redis connection options from env (Queue + Worker each use their own ioredis connections).
import type { ConnectionOptions } from 'bullmq'

/** Options object so BullMQ creates its own ioredis connections (required for Queue + Worker). */
export function getBullMqConnectionOptions(): ConnectionOptions {
  const password = (process.env.REDIS_PASSWORD || '').trim()
  const connectTimeoutMs = resolveRedisConnectTimeoutMs()
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    username: password ? (process.env.REDIS_USERNAME || 'default') : undefined,
    password: password || undefined,
    db: Number(process.env.REDIS_DB) || 0,
    maxRetriesPerRequest: null,
    // VPC / Cloud Run: allow longer handshakes than the ioredis default (10s).
    connectTimeout: connectTimeoutMs,
    keepAlive: 30_000,
    enableReadyCheck: true,
    retryStrategy: (times: number) => Math.min(times * 500, 10_000),
    reconnectOnError: (err: Error) => {
      const msg = err.message.toLowerCase()
      return msg.includes('readonly') || msg.includes('etimedout') || msg.includes('econnreset')
    }
  }
}

function resolveRedisConnectTimeoutMs(): number {
  const raw = Number(process.env.REDIS_CONNECT_TIMEOUT_MS)
  return Number.isFinite(raw) && raw >= 5_000 && raw <= 60_000 ? Math.floor(raw) : 30_000
}
