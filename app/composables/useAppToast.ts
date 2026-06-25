export type AppToastVariant = 'success' | 'error' | 'info'

export type AppToast = {
  id: number
  message: string
  variant: AppToastVariant
}

let nextToastId = 0

export function useAppToast() {
  const toasts = useState<AppToast[]>('app-toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(message: string, variant: AppToastVariant, durationMs = 5000) {
    const toast: AppToast = {
      id: ++nextToastId,
      message,
      variant
    }
    toasts.value = [...toasts.value, toast]
    if (import.meta.client && durationMs > 0) {
      window.setTimeout(() => dismiss(toast.id), durationMs)
    }
  }

  return {
    toasts,
    dismiss,
    success: (message: string) => push(message, 'success'),
    error: (message: string) => push(message, 'error'),
    info: (message: string) => push(message, 'info')
  }
}
