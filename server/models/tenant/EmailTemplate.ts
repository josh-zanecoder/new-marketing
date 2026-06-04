import mongoose from 'mongoose'

export const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  subject: { type: String, required: true, trim: true },
  htmlTemplate: { type: String, required: true },
  /** `upload` = raw import; `editor` = GrapesJS or library via editor path */
  htmlSource: { type: String, enum: ['editor', 'upload'], default: 'editor' },
  /** When false, template is campaign-only and hidden from the design modal library list. */
  saveToLibrary: { type: Boolean, default: true },
  externalId: { type: String, default: '', trim: true }
}, { timestamps: true })
