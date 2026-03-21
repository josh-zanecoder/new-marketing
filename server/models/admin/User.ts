import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  firebaseUid: { type: String, required: true, unique: true, index: true },
  /** `client` kept for legacy DB rows; treated as `tenant` in auth middleware. */
  role: {
    type: String,
    enum: ['admin', 'tenant', 'client'],
    default: 'tenant',
    required: true
  },
  tenantId: { type: String, default: null }
})

export default mongoose.models.User || mongoose.model('User', userSchema)
