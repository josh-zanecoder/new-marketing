import mongoose from 'mongoose'

export const brevoTrackingEventSchema = new mongoose.Schema(
  {
    email: { type: String, default: '', trim: true },
    /** Canonical ISO timestamp (preserves ms when present). */
    date: { type: String, required: true, trim: true },
    messageId: { type: String, required: true, trim: true },
    event: { type: String, required: true, trim: true },
    tag: { type: String, default: '', trim: true },
    subject: { type: String, default: '', trim: true },
    from: { type: String, default: '', trim: true },
    ip: { type: String, default: '', trim: true },
    link: { type: String, default: '', trim: true },
    reason: { type: String, default: '', trim: true },
    /** Parsed from `date` for range / proximity queries. */
    eventAt: { type: Date, default: null },
    /** Exact UTC ms of the event (proximity-deduped with webhook↔API copies). */
    eventKeyAt: { type: Number, default: null },
    campaignId: { type: String, default: '', trim: true },
    userEmail: { type: String, default: '', trim: true, lowercase: true }
  },
  { timestamps: true, collection: 'brevo_tracking_events' }
)

// Non-unique: webhook vs API copies differ by ms and are collapsed in app logic.
brevoTrackingEventSchema.index({ messageId: 1, event: 1, eventAt: 1 })
brevoTrackingEventSchema.index({ messageId: 1, event: 1, eventKeyAt: 1 })
brevoTrackingEventSchema.index({ eventAt: -1 })
brevoTrackingEventSchema.index({ campaignId: 1, eventAt: -1 })
brevoTrackingEventSchema.index({ userEmail: 1, eventAt: -1 })
brevoTrackingEventSchema.index({ event: 1, eventAt: -1 })

export type BrevoTrackingEventDoc = mongoose.InferSchemaType<typeof brevoTrackingEventSchema>
