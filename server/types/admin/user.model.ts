export type UserRole = 'admin' | 'client'

export interface IUser {
  email: string
  firebaseUid: string
  role: UserRole
}
