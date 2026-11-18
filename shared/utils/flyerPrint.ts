import { buildFlyerImagePrintHtml } from './buildFlyerImagePrintHtml'
import { buildFlyerFileUrl } from './flyerFileUrl'
import { isFlyerPdfMime } from './flyerUpload'

const PRINT_RETRY_MS = [500, 1200, 2200] as const

function resolveFlyerPrintUrl(input: { url: string; flyerId?: string }): string {
  const flyerId = String(input.flyerId ?? '').trim()
  return buildFlyerFileUrl(flyerId) || String(input.url ?? '').trim()
}

function attachNativePrintTriggers(win: Window): void {
  let printed = false
  const triggerPrint = () => {
    if (printed) return
    try {
      if (win.closed) return
      win.focus()
      win.print()
      printed = true
    } catch {
      // PDF plugin may not be ready yet; retries handle that.
    }
  }

  const onLoad = () => {
    window.setTimeout(triggerPrint, 300)
  }

  try {
    win.addEventListener('load', onLoad)
  } catch {
    // ignore: some browsers restrict access briefly
  }

  for (const delay of PRINT_RETRY_MS) {
    window.setTimeout(triggerPrint, delay)
  }

  try {
    win.addEventListener('afterprint', () => {
      try {
        win.close()
      } catch {
        // ignore
      }
    })
  } catch {
    // ignore
  }
}

/** PDF: open native browser viewer on the file URL, then print. */
function openPdfFlyerForPrint(printUrl: string): boolean {
  const win = window.open(printUrl, '_blank')
  if (!win) return false
  attachNativePrintTriggers(win)
  return true
}

/**
 * Image / non-PDF: print via a blank HTML page with `@page { margin: 0 }`
 * so Chrome does not stamp date + URL headers/footers (unlike raw image URLs).
 */
function openImageFlyerForPrint(printUrl: string, name?: string): boolean {
  const win = window.open('', '_blank')
  if (!win) return false

  const html = buildFlyerImagePrintHtml({ src: printUrl, name })
  try {
    win.document.open()
    win.document.write(html)
    win.document.close()
  } catch {
    try {
      win.close()
    } catch {
      // ignore
    }
    return false
  }

  const img = win.document.querySelector('img')
  let printed = false
  const triggerPrint = () => {
    if (printed) return
    try {
      if (win.closed) return
      win.focus()
      win.print()
      printed = true
    } catch {
      // ignore: image may still be decoding
    }
  }

  if (img) {
    if (img.complete) {
      window.setTimeout(triggerPrint, 50)
    } else {
      img.addEventListener('load', () => window.setTimeout(triggerPrint, 50), { once: true })
      img.addEventListener('error', () => window.setTimeout(triggerPrint, 50), { once: true })
    }
  }

  for (const delay of PRINT_RETRY_MS) {
    window.setTimeout(triggerPrint, delay)
  }

  try {
    win.addEventListener('afterprint', () => {
      try {
        win.close()
      } catch {
        // ignore
      }
    })
  } catch {
    // ignore
  }

  return true
}

/**
 * Open the flyer and auto-trigger print.
 * PDFs use the native file viewer; images use a marginless HTML print sheet
 * (no date/URL chrome that raw image tabs get in Chrome).
 */
export function openFlyerForPrint(input: {
  url: string
  flyerId?: string
  name?: string
  contentType?: string
}): boolean {
  if (typeof window === 'undefined') return false

  const printUrl = resolveFlyerPrintUrl(input)
  if (!printUrl) return false

  if (isFlyerPdfMime(input.contentType || '')) {
    return openPdfFlyerForPrint(printUrl)
  }

  return openImageFlyerForPrint(printUrl, input.name)
}
