/**
 * Short explanations for ratesheet-style SMTP dashboard metric labels.
 * Kept in sync with labels in `useBrevoSmtpStatsDashboard`.
 */
export const BREVO_SMTP_METRIC_EXPLANATIONS: ReadonlyArray<{ label: string; description: string }> = [
  {
    label: 'Emails sent',
    description: 'Total send requests for this campaign in the selected date range.',
  },
  {
    label: 'Delivered',
    description: 'Share of sent emails that were successfully delivered.',
  },
  {
    label: 'Estimated openers',
    description:
      'Share of sent emails that recorded an open (may include privacy-proxy opens).',
  },
  {
    label: 'Trackable openers',
    description:
      'Unique opens that can be attributed to a recipient (excluding privacy-proxy inflation where possible).',
  },
  {
    label: 'Unique clickers',
    description: 'Share of sent emails with at least one unique link click.',
  },
  {
    label: 'Bounced',
    description: 'Share of sent emails that hard or soft bounced.',
  },
  {
    label: 'Hard bounce',
    description: 'Permanent delivery failure — invalid or rejected address.',
  },
  {
    label: 'Soft bounce',
    description: 'Temporary delivery failure — full mailbox, greylisting, or similar.',
  },
  {
    label: 'Complaint',
    description: 'Share of sent emails reported as spam.',
  },
  {
    label: 'Blocked',
    description: 'Share of sent emails blocked by policy, reputation, or list rules.',
  },
]

const METRIC_TOOLTIPS: Record<string, string> = Object.fromEntries(
  BREVO_SMTP_METRIC_EXPLANATIONS.map((row) => [row.label, row.description]),
)

export function brevoSmtpMetricTooltip(label: string | undefined | null): string {
  const key = (label || '').trim()
  if (!key) return 'Email delivery metric.'
  return METRIC_TOOLTIPS[key] || `${key} metric from campaign email statistics.`
}
