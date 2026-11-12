import { requireTenantBeefreeBuilder } from '@server/utils/requireTenantBeefreeBuilder'

type BeefreeToken = {
  access_token: string
  v2?: boolean
}

function beefreeUid(dbName: string): string {
  const uid = dbName.trim().replace(/[^a-zA-Z0-9._-]/g, '')
  if (!uid) {
    throw createError({ statusCode: 400, message: 'Invalid tenant for the email builder' })
  }
  return uid.slice(0, 80)
}

export default defineEventHandler(async (event) => {
  const { auth } = await requireTenantBeefreeBuilder(event)

  const config = useRuntimeConfig()
  const clientId = String(config.beefreeClientId || '').trim()
  const clientSecret = String(config.beefreeClientSecret || '').trim()
  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 503,
      message: 'Email builder is not configured'
    })
  }

  const uid = beefreeUid(auth.dbName)
  let token: BeefreeToken
  try {
    token = await $fetch<BeefreeToken>('https://auth.getbee.io/loginV2', {
      method: 'POST',
      body: {
        client_id: clientId,
        client_secret: clientSecret,
        uid
      }
    })
  } catch {
    throw createError({ statusCode: 502, message: 'Could not start the email builder' })
  }

  if (!token || typeof token.access_token !== 'string' || !token.access_token) {
    throw createError({ statusCode: 502, message: 'Could not start the email builder' })
  }

  return token
})
