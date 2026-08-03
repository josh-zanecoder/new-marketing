import mongoose from 'mongoose'

/** Same TTL as the Brevo email events in-memory cache (5 minutes). */
export const BREVO_SMTP_STATS_CACHE_TTL_SECONDS = 300

export const brevoSmtpStatsCacheSchema = new mongoose.Schema(
  {
    /** Stable key: db|campaign|user|from|to|eventType|eventsLimit|eventsOffset */
    cacheKey: { type: String, required: true, trim: true },
    /** Full `BrevoTransactionalStatsResult` payload. */
    stats: { type: mongoose.Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, required: true, default: () => new Date() }
  },
  { timestamps: true, collection: 'brevo_smtp_stats_cache' }
)

brevoSmtpStatsCacheSchema.index({ cacheKey: 1 }, { unique: true })
brevoSmtpStatsCacheSchema.index(
  { fetchedAt: 1 },
  { expireAfterSeconds: BREVO_SMTP_STATS_CACHE_TTL_SECONDS }
)

export type BrevoSmtpStatsCacheDoc = mongoose.InferSchemaType<typeof brevoSmtpStatsCacheSchema>
