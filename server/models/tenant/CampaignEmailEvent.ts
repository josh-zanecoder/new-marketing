import mongoose from 'mongoose'

export const campaignEmailEventSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    brevoMessageId: { type: String, required: true, trim: true, index: true },
    event: { type: String, required: true, trim: true, lowercase: true, index: true },
    occurredAt: { type: Date, required: true, index: true },
    reason: { type: String, trim: true },
    link: { type: String, trim: true },
    tag: { type: String, trim: true },
    /** `${messageId}:${event}:${occurredAtMs}` — idempotent webhook inserts */
    dedupeKey: { type: String, required: true, unique: true, trim: true }
  },
  { timestamps: true }
)

campaignEmailEventSchema.index({ campaign: 1, occurredAt: -1 })
campaignEmailEventSchema.index({ campaign: 1, event: 1 })
