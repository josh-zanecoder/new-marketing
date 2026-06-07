import { isAdminAuthContext } from '@server/tenant/registry-auth'
import { cancelAllSendingCampaigns } from '@server/services/cancelCampaignSend.service'

export default defineEventHandler(async (event) => {
  const auth = event.context.auth as unknown
  if (!isAdminAuthContext(auth)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = (await readBody(event).catch(() => ({}))) as { confirm?: boolean; reason?: string }
  if (body.confirm !== true) {
    throw createError({
      statusCode: 400,
      message: 'Set confirm: true to cancel all in-flight campaign sends'
    })
  }

  const reports = await cancelAllSendingCampaigns({ reason: body.reason })
  return {
    cancelledCount: reports.length,
    reports
  }
})
