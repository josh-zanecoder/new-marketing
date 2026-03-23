import mongoose from 'mongoose'

export const recipientListMemberSchema = new mongoose.Schema(
  {
    recipientListId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecipientList',
      required: true,
      index: true
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
      index: true
    }
  },
  { timestamps: true, collection: 'recipient_list_members' }
)

recipientListMemberSchema.index(
  { recipientListId: 1, contactId: 1 },
  { unique: true }
)
