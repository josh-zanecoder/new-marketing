/** Normalize Brevo / SMTP message ids for lookup (webhook vs send API may differ slightly). */
export function brevoMessageIdVariants(raw: string): string[] {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return []
  const out = new Set<string>()
  out.add(trimmed)
  const withoutBrackets = trimmed.replace(/^<|>$/g, '').trim()
  if (withoutBrackets) {
    out.add(withoutBrackets)
    out.add(`<${withoutBrackets}>`)
  }
  return [...out]
}
