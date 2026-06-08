import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['server/**/__tests__/**/*.test.ts', 'app/**/__tests__/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@server': fileURLToPath(new URL('./server', import.meta.url))
    }
  }
})
