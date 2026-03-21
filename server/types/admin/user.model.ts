export type UserRole = 'admin' | 'client'

export interface IUser {
  email: string
  firebaseUid: string
  role: UserRole
  /** Set for `client` users; must match a registry client. Admins omit. */
  tenantId?: string | null
}
