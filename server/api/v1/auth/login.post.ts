import User from '../../../models/User'
import type { Model } from 'mongoose'
import type { IUser } from '../../../types/user.model'

interface LoginBody {
  email?: string
}

export default defineEventHandler(async (event) => {
  const UserModel = User as unknown as Model<IUser>
  const body = await readBody<LoginBody>(event)
  const email = body?.email?.trim().toLowerCase()

  if (!email) {
    throw createError({
      statusCode: 400,
      message: 'email is required in body'
    })
  }

  await getRegistryConnection()
  const mongoUser = await UserModel.findOne({ email }).lean()

  if (!mongoUser) {
    throw createError({
      statusCode: 403,
      message: 'User is not allowed to access this app'
    })
  }

  return {
    ok: true,
    user: {
      uid: mongoUser.firebaseUid || '',
      email: mongoUser.email || '',
      role: mongoUser.role,
      name: '',
      photoURL: '',
      emailVerified: true
    }
  }
})
