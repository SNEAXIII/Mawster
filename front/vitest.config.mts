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
      // Pure logic only: hooks, viewmodels and components are E2E's. Mirrored by
      // sonar.coverage.exclusions in sonar-project.properties.
      include: [
        'app/lib/**/*.ts',
        'app/services/**/*.ts',
        'app/tools/_lib/**/*.ts',
        'app/game/**/_components/*.ts',
        'components/roster/*.ts',
      ],
      exclude: ['**/use-*.ts'],
      // Paths from the repo root, where the Sonar scanner runs.
      reporter: [
        'text-summary',
        ['lcov', { projectRoot: fileURLToPath(new URL('..', import.meta.url)) }],
      ],
    },
  },
})
