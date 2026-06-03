export function useClipboardCopy() {
  const copied = ref(false)

  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text)
      copied.value = true
      setTimeout(() => { copied.value = false }, 2000)
      return true
    } catch {
      try {
        const input = document.createElement('input')
        input.value = text
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
        copied.value = true
        setTimeout(() => { copied.value = false }, 2000)
        return true
      } catch {
        return false
      }
    }
  }

  return { copied, copyText }
}
