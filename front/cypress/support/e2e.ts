/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />

import './commands';

// Prevent uncaught exceptions from failing tests (e.g. third-party scripts)
Cypress.on('uncaught:exception', (_err) => {
  return false;
});
