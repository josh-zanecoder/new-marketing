import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  firebaseUid: { type: String, required: true, unique: true, index: true, trim: true },
  role: { type: String, enum: ['admin', 'client'], default: 'client', required: true },
  tenantId: { type: String, trim: true, index: true, default: null }
}, { timestamps: true })

export type UserDocument = mongoose.InferSchemaType<typeof userSchema>

export const User = mongoose.models.User || mongoose.model('User', userSchema)

export default User
