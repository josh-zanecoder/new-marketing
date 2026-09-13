/** Human GET of the header URL → preference page (POST is one-click). */
export default defineEventHandler((event) => {
  const token = String(getQuery(event).token ?? '').trim()
  const target = token
    ? `/api/v1/unsubscribe?token=${encodeURIComponent(token)}`
    : '/api/v1/unsubscribe'
  return sendRedirect(event, target, 302)
})
