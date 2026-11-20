import mongoose from 'mongoose'

export const flyerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailTemplateCategory',
      default: null
    },
    imageUrl: { type: String, required: true, trim: true },
    objectPath: { type: String, required: true, trim: true },
    fileName: { type: String, default: '', trim: true },
    contentType: { type: String, default: '', trim: true },
    size: { type: Number, default: 0 },
    /** Soft-delete timestamp; null = active in the Custom Flyers library. */
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: 'flyers' }
)

flyerSchema.index({ categoryId: 1, createdAt: -1 })
flyerSchema.index({ createdAt: -1 })
flyerSchema.index({ deletedAt: 1 })

export type FlyerDoc = mongoose.InferSchemaType<typeof flyerSchema>
