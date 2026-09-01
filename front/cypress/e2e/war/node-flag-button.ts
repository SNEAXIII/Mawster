import { setupAssignedAttacker, setupAttackerScenario } from '../../support/e2e';

type ToggleViaApi = (token: string, allianceId: string, warId: string, battlegroup: number, nodeNumber: number) => void;

// planning-error and fight-not-done are the same node button behind two flags:
// officer-only, hidden until an attacker is assigned, toggling an amber highlight.
// Both specs call this inside their own describe, so each can still add the tests
// that are specific to its flag.
export function itBehavesLikeANodeFlagButton(flag: string, prefix: string, toggleViaApi: ToggleViaApi) {
  const button = `${flag}-node-10`;

  it(`${flag} button is hidden when no attacker is assigned`, () => {
    setupAttackerScenario(`${prefix}-no-atk`).then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy(button).should('not.exist');
    });
  });

  it(`${flag} button appears for officer after attacker is assigned`, () => {
    setupAssignedAttacker(`${prefix}-appears`).then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy(button).should('be.visible');
    });
  });

  it(`${flag} button is hidden for regular member`, () => {
    setupAssignedAttacker(`${prefix}-member`).then(({ memberData }) => {
      cy.apiLogin(memberData.user_id, 'war');
      cy.getByCy(button).should('not.exist');
    });
  });

  it(`clicking ${flag} button marks the node`, () => {
    setupAssignedAttacker(`${prefix}-toggle-on`).then(({ ownerData }) => {
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy(button).click();
      cy.getByCy(button).should('have.class', 'bg-amber-500');
    });
  });

  it(`clicking ${flag} button again unmarks the node`, () => {
    setupAssignedAttacker(`${prefix}-toggle-off`).then(({ ownerData, allianceId, warId }) => {
      toggleViaApi(ownerData.access_token, allianceId, warId, 1, 10);
      cy.goToWarMode(ownerData.user_id, 'attackers');
      cy.getByCy(button).click();
      cy.getByCy(button).should('not.have.class', 'bg-amber-500');
    });
  });
}
