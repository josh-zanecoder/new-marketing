export const TENANT_EMAIL_PROVIDER_BREVO = 'BREVO' as const
export const TENANT_EMAIL_PROVIDER_ZC_MAIL = 'ZC_MAIL' as const

export type TenantEmailProvider =
  | typeof TENANT_EMAIL_PROVIDER_BREVO
  | typeof TENANT_EMAIL_PROVIDER_ZC_MAIL

export const TENANT_EMAIL_PROVIDERS: TenantEmailProvider[] = [
  TENANT_EMAIL_PROVIDER_BREVO,
  TENANT_EMAIL_PROVIDER_ZC_MAIL
]

export function parseTenantEmailProvider(raw: unknown): TenantEmailProvider {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_')
  if (s === 'ZC_MAIL' || s === 'ZCMAIL') return TENANT_EMAIL_PROVIDER_ZC_MAIL
  return TENANT_EMAIL_PROVIDER_BREVO
}
