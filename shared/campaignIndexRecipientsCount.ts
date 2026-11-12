/**
 * Campaign list/index rows omit recipient emails; they expose a count instead.
 * Both manual and list audiences persist the selected contacts on ManualRecipient.
 */
export function campaignIndexRecipientsCount(
  recipientsType: string | null | undefined,
  storedRecipientRows: number
): number {
  if (recipientsType !== 'manual' && recipientsType !== 'list') return 0
  return storedRecipientRows > 0 ? storedRecipientRows : 0
}
