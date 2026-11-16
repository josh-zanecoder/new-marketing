import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const outDir = fileURLToPath(new URL('../public/grapes-builder', import.meta.url))

/**
 * Isolated Grapes email builder — built into Marketing `public/grapes-builder`
 * and iframed same-origin (crash-isolated, still inside Marketing like workers).
 */
export default defineConfig({
  root,
  base: '/grapes-builder/',
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 3010,
    strictPort: true
  }
})
