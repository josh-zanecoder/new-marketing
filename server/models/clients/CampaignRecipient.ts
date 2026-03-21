import mongoose from 'mongoose'

const statusEnum = ['pending', 'sent', 'failed'] as const

export const campaignRecipientSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  email: { type: String, required: true, trim: true },
  status: { type: String, enum: statusEnum, default: 'pending' },
  sentAt: { type: Date },
  error: { type: String },
  clientId: { type: String, default: '' }
}, { timestamps: true })

campaignRecipientSchema.index({ campaign: 1, email: 1 }, { unique: true })
campaignRecipientSchema.index({ campaign: 1, status: 1 })
