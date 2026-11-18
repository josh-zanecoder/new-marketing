let workerConfigured = false

/** Configure pdfjs worker once (browser only). */
export async function ensureFlyerPdfjsWorker() {
  if (typeof window === 'undefined') {
    throw new Error('PDF rendering requires a browser')
  }
  const pdfjs = await import('pdfjs-dist')
  if (!workerConfigured) {
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    workerConfigured = true
  }
  return pdfjs
}
