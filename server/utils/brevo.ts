// Brevo client for sending emails

export function getBrevoApiKey(): string {
  try {
    const config = useRuntimeConfig()
    const key = config.brevoApiKey || process.env.BREVO_API_KEY || ''
    return key
  } catch {
    return process.env.BREVO_API_KEY || ''
  }
}
