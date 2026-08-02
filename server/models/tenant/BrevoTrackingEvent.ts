import mongoose from 'mongoose'

export const brevoTrackingEventSchema = new mongoose.Schema(
  {
    email: { type: String, default: '', trim: true },
    /** Brevo event timestamp string (part of upsert key). */
    date: { type: String, required: true, trim: true },
    messageId: { type: String, required: true, trim: true },
    event: { type: String, required: true, trim: true },
    tag: { type: String, default: '', trim: true },
    /** Parsed from `date` for range queries. */
    eventAt: { type: Date, default: null },
    campaignId: { type: String, default: '', trim: true },
    userEmail: { type: String, default: '', trim: true, lowercase: true }
  },
  { timestamps: true, collection: 'brevo_tracking_events' }
)

brevoTrackingEventSchema.index({ messageId: 1, event: 1, date: 1 }, { unique: true })
brevoTrackingEventSchema.index({ eventAt: -1 })
brevoTrackingEventSchema.index({ campaignId: 1, eventAt: -1 })
brevoTrackingEventSchema.index({ userEmail: 1, eventAt: -1 })
brevoTrackingEventSchema.index({ event: 1, eventAt: -1 })

export type BrevoTrackingEventDoc = mongoose.InferSchemaType<typeof brevoTrackingEventSchema>
