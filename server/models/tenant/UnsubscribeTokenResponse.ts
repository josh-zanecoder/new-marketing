import mongoose from 'mongoose'

/** One preference response per signed unsubscribe token (token is single-use). */
export const unsubscribeTokenResponseSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, trim: true },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true
    },
    /** Preference chosen when the token was consumed (`true` = stay subscribed). */
    marketing: { type: Boolean, required: true },
    respondedAt: { type: Date, required: true, default: () => new Date() }
  },
  { timestamps: true, collection: 'unsubscribe_token_responses' }
)

unsubscribeTokenResponseSchema.index({ tokenHash: 1 }, { unique: true })
unsubscribeTokenResponseSchema.index(
  { respondedAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
)
