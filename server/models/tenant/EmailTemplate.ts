import mongoose from 'mongoose'

export const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  subject: { type: String, required: true, trim: true },
  htmlTemplate: { type: String, required: true },
  /** `upload` = raw import; `editor` = GrapesJS; `custom` = plain personal-style compose */
  htmlSource: { type: String, enum: ['editor', 'upload', 'custom'], default: 'editor' },
  /** When false, template is campaign-only and hidden from the design modal library list. */
  saveToLibrary: { type: Boolean, default: true },
  externalId: { type: String, default: '', trim: true },
  /** Optional library category (`email_template_categories`). */
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplateCategory', default: null }
}, { timestamps: true })

emailTemplateSchema.index({ categoryId: 1 })
