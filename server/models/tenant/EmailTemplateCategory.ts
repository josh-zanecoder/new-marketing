import mongoose from 'mongoose'

export const emailTemplateCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true, collection: 'email_template_categories' }
)

emailTemplateCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })

export type EmailTemplateCategoryDoc = mongoose.InferSchemaType<typeof emailTemplateCategorySchema>
