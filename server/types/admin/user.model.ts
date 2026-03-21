/** `client` is legacy; new users should use `tenant`. Middleware treats both as tenant. */
export type UserRole = 'admin' | 'tenant' | 'client'

export interface IUser {
  email: string
  firebaseUid: string
  role: UserRole
  /** Set for tenant users; must match a registry row. Admins omit. */
  tenantId?: string | null
}
