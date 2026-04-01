import mongoose from 'mongoose'

export const contactTypeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true, collection: 'contact_types' }
)

contactTypeSchema.index({ key: 1 }, { unique: true })

export type ContactTypeDoc = mongoose.InferSchemaType<typeof contactTypeSchema>
