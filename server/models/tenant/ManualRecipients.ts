import mongoose from 'mongoose'

export const manualRecipientSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true },
    contact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true
    },
    clientId: { type: String, default: '' }
  },
  { timestamps: true }
)

manualRecipientSchema.index({ campaign: 1 })
manualRecipientSchema.index({ campaign: 1, contact: 1 }, { unique: true })
