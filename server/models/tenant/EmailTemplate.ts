import mongoose from 'mongoose'

const emailTemplateMetadataSchema = new mongoose.Schema(
  {
    /**
     * Lowercased owner email. Set = private to that owner (and users whose `contactOwnerScope`
     * includes it). Empty = shared with the whole tenant (CRM-synced, admin, legacy templates).
     */
    ownerEmail: { type: String, default: '', trim: true, lowercase: true }
  },
  { _id: false }
)

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
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplateCategory', default: null },
  /** Soft-delete timestamp; null = active in the library. */
  deletedAt: { type: Date, default: null },
  metadata: { type: emailTemplateMetadataSchema, default: () => ({}) },
  /** Tenant user id or email who created the template. */
  createdBy: { type: String, default: '', trim: true }
}, { timestamps: true })

emailTemplateSchema.index({ categoryId: 1 })
emailTemplateSchema.index({ deletedAt: 1 })
emailTemplateSchema.index({ 'metadata.ownerEmail': 1 })
