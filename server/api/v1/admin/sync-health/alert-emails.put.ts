import { assertAdminAuth } from '@server/utils/admin/adminCampaigns'
import {
  parseAlertEmailsInput,
  setMarketingSyncAlertEmails
} from '@server/utils/marketingSyncHealth/alertSettings'

export default defineEventHandler(async (event) => {
  assertAdminAuth(event)

  const body = await readBody<{ emails?: unknown; alertEmails?: unknown }>(event).catch(
    () => ({}) as { emails?: unknown; alertEmails?: unknown }
  )
  const raw = body.alertEmails ?? body.emails ?? ''

  if (typeof raw === 'string') {
    const tokens = raw.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean)
    const parsed = parseAlertEmailsInput(raw)
    if (tokens.length > 0 && parsed.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No valid email addresses provided'
      })
    }
  }

  const settings = await setMarketingSyncAlertEmails(raw)
  return {
    ok: true,
    alertEmails: settings.alertEmails,
    updatedAt: settings.updatedAt
  }
})
