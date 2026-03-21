import mongoose from 'mongoose'

const campaignStatusEnum = ['Draft', 'Scheduled', 'Sending', 'Sent', 'Failed'] as const
const recipientsTypeEnum = ['manual', 'list'] as const

export const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sender: {
    name: { type: String, required: true },
    email: { type: String, required: true }
  },
  recipientsType: { type: String, enum: recipientsTypeEnum, default: 'manual' },
  recipientsListId: { type: String, default: '' },
  emailTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' },
  subject: { type: String, default: '' },
  status: { type: String, enum: campaignStatusEnum, default: 'Draft' },
  clientId: { type: String, default: '' }
}, { timestamps: true })
