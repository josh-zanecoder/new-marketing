export function fetchErrorMessage(e: unknown, fallback: string): string {
  if (
    e &&
    typeof e === 'object' &&
    'data' in e &&
    e.data &&
    typeof e.data === 'object' &&
    'message' in e.data
  ) {
    return String((e.data as { message?: string }).message)
  }
  return fallback
}
