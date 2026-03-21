import mongoose from 'mongoose'

export const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  html: { type: String, required: true },
  clientId: { type: String, default: '' }
}, { timestamps: true })
