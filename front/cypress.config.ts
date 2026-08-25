import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    defaultCommandTimeout: 5000,
    // A full page load costs a Next.js SSR round-trip plus the backend call it
    // fans out to. On a 2-core CI runner that shares the box with MariaDB, the
    // API and `next start`, 5s was a coin flip — and when the runner stalls it
    // takes every visit in the spec down at once, which retries cannot save.
    // 10s buys the margin without letting a genuinely hung page burn the job.
    pageLoadTimeout: 10000,
    requestTimeout: 5000,
    responseTimeout: 5000,
    numTestsKeptInMemory: 0,
    // Absorbs the residual per-test flake. Deliberately off in openMode so a
    // real failure surfaces immediately while debugging.
    retries: { runMode: 2, openMode: 0 },
  },
  video: false,
  screenshotOnRunFailure: true, // Keep screenshots of failed tests
  screenshotsFolder: 'cypress/results/screenshots',
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    configFile: 'cypress/reporter-config.json',
  },
})
