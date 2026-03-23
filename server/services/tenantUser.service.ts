import { getFirebaseAuth } from './firebase.service'
import User from '../models/admin/User'
import type { Model } from 'mongoose'
import type { IUser } from '../types/admin/user.model'

const DEFAULT_PASSWORD = 'Default@123'

export async function createTenantUser(
  email: string,
  tenantId: string
): Promise<{ uid: string } | null> {
  const emailTrimmed = email.trim().toLowerCase()
  if (!emailTrimmed) return null

  const auth = getFirebaseAuth()
  const UserModel = User as unknown as Model<IUser>

  let uid: string
  try {
    const userRecord = await auth.createUser({
      email: emailTrimmed,
      password: DEFAULT_PASSWORD,
      emailVerified: true
    })
    uid = userRecord.uid
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : ''
    if (code === 'auth/email-already-exists') {
      const existing = await auth.getUserByEmail(emailTrimmed)
      uid = existing.uid
    } else {
      throw err
    }
  }

  await UserModel.findOneAndUpdate(
    { email: emailTrimmed },
    { firebaseUid: uid, email: emailTrimmed, role: 'tenant', tenantId },
    { upsert: true, new: true }
  )

  return { uid }
}
