export function expectRosterCards(visible: string[], hidden: string[] = []) {
  visible.forEach((name) => cy.getByCy(`champion-card-${name}`).should('exist'));
  hidden.forEach((name) => cy.getByCy(`champion-card-${name}`).should('not.exist'));
}

export function filterRosterByName(text: string) {
  cy.getByCy('roster-filter-name').type(text);
}

export function capRosterRankAt7r1() {
  cy.getByCy('roster-filter-rank').find('[role="slider"]').last().focus().type('{leftarrow}'.repeat(5));
}

export function raiseRosterMinSigTo100() {
  cy.getByCy('roster-filter-sig').find('[role="slider"]').first().focus().type('{pageup}'.repeat(10));
}

export function expectNoResultsThenReset(restored: string) {
  cy.getByCy('roster-no-results').should('be.visible');
  cy.getByCy('roster-empty').should('not.exist');

  cy.getByCy('roster-filter-reset').click();
  cy.getByCy(`champion-card-${restored}`).should('exist');
  cy.getByCy('roster-no-results').should('not.exist');
}
