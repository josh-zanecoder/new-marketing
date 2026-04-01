import { buildTenantMeResponse } from '@server/tenant/tenant-me'

export default defineEventHandler(async (event) => {
  const me = await buildTenantMeResponse(event)
  return { me }
})
