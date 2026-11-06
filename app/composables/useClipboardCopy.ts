/** Copy text even inside CRM/Retail iframes where `navigator.clipboard` is often blocked. */
function copyTextWithFallback(text: string): boolean {
  const value = String(text ?? '')
  if (!value) return false

  const ta = document.createElement('textarea')
  ta.value = value
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '0'
  ta.style.width = '1px'
  ta.style.height = '1px'
  ta.style.padding = '0'
  ta.style.border = 'none'
  ta.style.outline = 'none'
  ta.style.boxShadow = 'none'
  ta.style.background = 'transparent'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  ta.setSelectionRange(0, value.length)
  let ok: boolean
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  return ok
}

export function useClipboardCopy() {
  const copied = ref(false)

  async function copyText(text: string): Promise<boolean> {
    const value = String(text ?? '')
    if (!value) return false

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value)
        copied.value = true
        setTimeout(() => {
          copied.value = false
        }, 2000)
        return true
      }
    } catch {
      // Fall through — common when Marketing is embedded in an iframe.
    }

    const ok = copyTextWithFallback(value)
    if (ok) {
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    }
    return ok
  }

  return { copied, copyText }
}
