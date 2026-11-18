import mongoose from 'mongoose'

export function serializeFlyer(
  doc: {
    _id: mongoose.Types.ObjectId
    name: string
    categoryId?: mongoose.Types.ObjectId | null
    imageUrl: string
    objectPath: string
    fileName?: string
    contentType?: string
    size?: number
    createdAt?: Date
    updatedAt?: Date
  },
  categoryName?: string | null
) {
  const categoryId = doc.categoryId ? String(doc.categoryId) : null
  return {
    id: String(doc._id),
    name: doc.name,
    categoryId,
    categoryName: categoryName ?? null,
    imageUrl: doc.imageUrl,
    objectPath: doc.objectPath,
    fileName: doc.fileName ?? '',
    contentType: doc.contentType ?? '',
    size: typeof doc.size === 'number' ? doc.size : 0,
    createdAt: doc.createdAt?.toISOString?.() ?? null,
    updatedAt: doc.updatedAt?.toISOString?.() ?? null
  }
}
