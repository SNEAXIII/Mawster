import { itBehavesLikeANodeFlagButton } from './node-flag-button';

describe('War – Planning Error', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  itBehavesLikeANodeFlagButton('planning-error', 'pe', (token, allianceId, warId, bg, node) => {
    cy.apiTogglePlanningError(token, allianceId, warId, bg, node);
  });
});
