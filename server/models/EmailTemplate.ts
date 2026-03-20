import mongoose from 'mongoose'

const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  html: { type: String, required: true },
  clientId: { type: String, default: '' }
}, { timestamps: true })

export const EmailTemplate = mongoose.models.EmailTemplate || mongoose.model('EmailTemplate', emailTemplateSchema)
