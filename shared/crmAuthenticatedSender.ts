/** Minimal auth/me user fields used to resolve Custom Marketing From. */
export type CrmAuthenticatedSenderInput = {
  email?: string | null
  name?: string | null
  firstName?: string | null
  lastName?: string | null
}

export type CrmAuthenticatedSender = {
  name: string
  email: string
}

/** Prefer CRM handoff / authenticated user email (and display name) for From. */
export function resolveCrmAuthenticatedSender(
  user: CrmAuthenticatedSenderInput | null | undefined
): CrmAuthenticatedSender | null {
  if (!user) return null
  const email = String(user.email ?? '').trim()
  if (!email) return null
  const fullName = [user.firstName, user.lastName]
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' ')
  const name = fullName || String(user.name ?? '').trim() || email
  return { name, email }
}
