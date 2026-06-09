import mongoose from 'mongoose'

const statusEnum = ['pending', 'sending', 'sent', 'failed', 'cancelled'] as const

export const campaignRecipientSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  email: { type: String, required: true, trim: true },
  status: { type: String, enum: statusEnum, default: 'pending' },
  sentAt: { type: Date },
  error: { type: String },
  /** Brevo transactional message id from send response (dedupe / webhook correlation). */
  brevoMessageId: { type: String, default: '', trim: true },
  brevoLastEvent: { type: String, default: '', trim: true },
  brevoLastEventAt: { type: Date },
  clientId: { type: String, default: '' }
}, { timestamps: true })

campaignRecipientSchema.index({ campaign: 1, email: 1 }, { unique: true })
campaignRecipientSchema.index({ campaign: 1, status: 1 })
/** Claim query: find pending/failed sorted by _id within a campaign. */
campaignRecipientSchema.index({ campaign: 1, status: 1, _id: 1 })
