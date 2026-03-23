import { defineConfig } from 'cypress';
import cypressSplit from 'cypress-split';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3001',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    setupNodeEvents(on, config) {
      cypressSplit(on, config);
      return config;
    },
    defaultCommandTimeout: 5000,
    pageLoadTimeout: 5000,
    requestTimeout: 5000,
    responseTimeout: 5000,
    numTestsKeptInMemory: 0,
  },
  video: false,
  screenshotOnRunFailure: true, // Keep screenshots of failed tests
  screenshotsFolder: 'cypress/results/screenshots',
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    configFile: 'cypress/reporter-config.json',
  },
});
