import { setResponseHeader } from 'h3'

/**
 * Retail embeds Marketing in an iframe. The framed document must allow the parent via `frame-ancestors`.
 *
 * Default: `frame-ancestors *` (no Marketing env). Optional: `MARKETING_FRAME_ANCESTORS` or
 * `NUXT_MARKETING_FRAME_ANCESTORS` — space- or comma-separated origins → `frame-ancestors 'self' <origins>`.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    if ((event.path || '').startsWith('/api/')) return

    const raw = process.env.NUXT_MARKETING_FRAME_ANCESTORS || process.env.MARKETING_FRAME_ANCESTORS || ''
    const origins = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)

    const csp =
      origins.length === 0
        ? 'frame-ancestors *'
        : `frame-ancestors 'self' ${origins.join(' ')}`

    setResponseHeader(event, 'Content-Security-Policy', csp)
  })
})
