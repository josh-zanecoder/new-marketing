export async function runTasksWithConcurrency<T>(
  items: T[],
  concurrency: number,
  run: (item: T) => Promise<void>,
  afterBatch?: () => Promise<void>
): Promise<void> {
  const limit = Math.max(1, Math.floor(concurrency));
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    await Promise.all(batch.map((item) => run(item)));
    if (afterBatch) await afterBatch();
  }
}

export function resolveMarketingSyncRecipientListConcurrency(): number {
  const raw = Number(process.env.MARKETING_SYNC_RECIPIENT_LIST_CONCURRENCY);
  if (Number.isFinite(raw) && raw >= 1) return Math.min(50, Math.floor(raw));
  return 10;
}
