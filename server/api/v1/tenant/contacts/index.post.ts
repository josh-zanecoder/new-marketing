import { getTenantConnectionFromEvent } from '@server/tenant/connection'
import { createTenantContact, parseContactAddressBody } from '@server/utils/contact/createTenantContact'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: 'Request body is required' })
  }

  const conn = await getTenantConnectionFromEvent(event)
  const contact = await createTenantContact(conn, event.context.auth, {
    firstName: typeof body.firstName === 'string' ? body.firstName : '',
    lastName: typeof body.lastName === 'string' ? body.lastName : '',
    email: typeof body.email === 'string' ? body.email : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    company: typeof body.company === 'string' ? body.company : '',
    contactType: body.contactType as string | string[] | undefined,
    channel: typeof body.channel === 'string' ? body.channel : undefined,
    status: typeof body.status === 'string' ? body.status : undefined,
    stage: typeof body.stage === 'string' ? body.stage : undefined,
    address: parseContactAddressBody(body.address)
  })

  return { ok: true, contact }
})
