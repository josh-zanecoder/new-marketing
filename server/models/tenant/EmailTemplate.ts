import mongoose from 'mongoose'

export const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  subject: { type: String, required: true, trim: true },
  htmlTemplate: { type: String, required: true },
  externalId: { type: String, default: '', trim: true }
}, { timestamps: true })
