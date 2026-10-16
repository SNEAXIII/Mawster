import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      // Hooks stay listed: their 0% is the honest map of what only E2E covers.
      include: ['app/**/*.ts', 'components/**/*.ts', 'lib/**/*.ts'],
      exclude: ['app/i18n/locales/**', '**/*.d.ts'],
      reporter: ['text-summary', 'lcov'],
    },
  },
})
