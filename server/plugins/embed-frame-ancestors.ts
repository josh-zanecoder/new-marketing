import { setResponseHeader } from 'h3'

/**
 * Retail (and other parents) embed Marketing in an iframe. Browsers enforce the
 * **child** document's `frame-ancestors` directive — it must list every parent origin.
 *
 * - **Non-production** (typical `nuxt dev`): `frame-ancestors *` so any local host/port works.
 * - **Production**: set `MARKETING_FRAME_ANCESTORS` / `NUXT_MARKETING_FRAME_ANCESTORS`
 *   (space- or comma-separated full origins, e.g. `https://crm.example.com`).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    const path = event.path || ''
    if (path.startsWith('/api/')) return

    const strictDev = process.env.MARKETING_STRICT_FRAME_ANCESTORS === 'true'
    const isProd = process.env.NODE_ENV === 'production'

    if (!isProd && !strictDev) {
      setResponseHeader(event, 'Content-Security-Policy', 'frame-ancestors *')
      return
    }

    const extras = (
      process.env.NUXT_MARKETING_FRAME_ANCESTORS ||
      process.env.MARKETING_FRAME_ANCESTORS ||
      ''
    )
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean)

    const bases = [
      "'self'",
      'http://localhost:3002',
      'http://127.0.0.1:3002',
      'http://[::1]:3002',
      'http://0.0.0.0:3002',
      'https://localhost:3002',
      'https://127.0.0.1:3002'
    ]

    const merged = [...new Set([...bases, ...extras])].join(' ')
    setResponseHeader(event, 'Content-Security-Policy', `frame-ancestors ${merged}`)
  })
})
