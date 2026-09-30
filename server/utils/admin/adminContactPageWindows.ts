/** Which tenant slices to query for one page when contacts are ordered tenant-by-tenant. */
export function adminContactPageWindows(
  counts: number[],
  skip: number,
  limit: number
): Array<{ index: number; skip: number; limit: number }> {
  const windows: Array<{ index: number; skip: number; limit: number }> = []
  let remainingSkip = Math.max(0, skip)
  let need = Math.max(0, limit)

  for (let index = 0; index < counts.length && need > 0; index++) {
    const count = counts[index] ?? 0
    if (count <= 0) continue
    if (remainingSkip >= count) {
      remainingSkip -= count
      continue
    }
    const take = Math.min(need, count - remainingSkip)
    windows.push({ index, skip: remainingSkip, limit: take })
    need -= take
    remainingSkip = 0
  }

  return windows
}
