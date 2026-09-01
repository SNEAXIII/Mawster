import { setupAssignedAttacker, setupAttackerScenario } from '../../support/e2e';

type ToggleViaApi = (token: string, allianceId: string, warId: string, battlegroup: number, nodeNumber: number) => void;

// planning-error and fight-not-done are the same node button behind two flags:
// officer-only, hidden until an attacker is assigned, toggling an amber highlight.
// Only the bodies are shared — each spec still declares its own it() titles, so the
// test list stays readable in the file it belongs to.
export function nodeFlagButtonBehaviour(flag: string, prefix: string, toggleViaApi: ToggleViaApi) {
  const button = `${flag}-node-10`;

  return {
    hiddenWithoutAttacker: () => {
      setupAttackerScenario(`${prefix}-no-atk`).then(({ ownerData }) => {
        cy.goToWarMode(ownerData.user_id, 'attackers');
        cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
        cy.getByCy(button).should('not.exist');
      });
    },

    visibleForOfficer: () => {
      setupAssignedAttacker(`${prefix}-appears`).then(({ ownerData }) => {
        cy.goToWarMode(ownerData.user_id, 'attackers');
        cy.getByCy(button).should('be.visible');
      });
    },

    hiddenForMember: () => {
      setupAssignedAttacker(`${prefix}-member`).then(({ memberData }) => {
        cy.apiLogin(memberData.user_id, 'war');
        cy.getByCy(button).should('not.exist');
      });
    },

    marksNode: () => {
      setupAssignedAttacker(`${prefix}-toggle-on`).then(({ ownerData }) => {
        cy.goToWarMode(ownerData.user_id, 'attackers');
        cy.getByCy(button).click();
        cy.getByCy(button).should('have.class', 'bg-amber-500');
      });
    },

    unmarksNode: () => {
      setupAssignedAttacker(`${prefix}-toggle-off`).then(({ ownerData, allianceId, warId }) => {
        toggleViaApi(ownerData.access_token, allianceId, warId, 1, 10);
        cy.goToWarMode(ownerData.user_id, 'attackers');
        cy.getByCy(button).click();
        cy.getByCy(button).should('not.have.class', 'bg-amber-500');
      });
    },
  };
}
