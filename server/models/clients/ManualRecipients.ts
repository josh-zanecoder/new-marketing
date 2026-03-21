import mongoose from 'mongoose'

export const manualRecipientSchema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
  email: { type: String, required: true, trim: true },
  clientId: { type: String, default: '' }
}, { timestamps: true })

manualRecipientSchema.index({ campaign: 1 })
