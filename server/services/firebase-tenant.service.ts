import { getFirebaseAuth } from './firebase.service'

function sanitizeTenantDisplayName(input: string): string {
  const normalized = input
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .slice(0, 20)
  if (!normalized) return 'tenant'
  if (!/^[a-zA-Z]/.test(normalized)) return `t${normalized}`.slice(0, 20)
  return normalized
}

export async function createFirebaseIdentityTenant(displayName: string): Promise<string | null> {
  try {
    const auth = getFirebaseAuth()
    const tenant = await auth.tenantManager().createTenant({
      displayName: sanitizeTenantDisplayName(displayName),
      emailSignInConfig: { enabled: true, passwordRequired: true }
    })
    return tenant.tenantId
  } catch (error) {
    console.error('[FirebaseTenant] create failed:', error)
    return null
  }
}
