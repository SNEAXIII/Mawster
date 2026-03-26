import { setupAttackerScenario } from '../../support/e2e';

describe('War – Attackers mode', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  function goToAttackersMode(userId: string) {
    cy.apiLogin(userId);
    cy.navTo('war');
    cy.getByCy('war-mode-attackers').click();
  }

  // ── Attacker panel visible in Attackers mode ──────────────────────────────

  it('attackers panel is visible by default (Attackers mode)', () => {
    setupAttackerScenario('atk-panel').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('war-mode-attackers').should('have.class', 'bg-primary');
    });
  });

  // ── Assign attacker via API and check sidebar ─────────────────────────────

  it('assigned attacker appears in the attacker panel', () => {
    setupAttackerScenario('atk-sidebar').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);
      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
    });
  });

  // ── KO increment / decrement ──────────────────────────────────────────────

  it('member can increment and decrement KO count', () => {
    setupAttackerScenario('atk-ko').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('ko-value-node-10').should('have.text', '0');
      cy.getByCy('ko-inc-node-10').click();
      cy.getByCy('ko-value-node-10').should('have.text', '1');
      cy.getByCy('ko-inc-node-10').click();
      cy.getByCy('ko-value-node-10').should('have.text', '2');
      cy.getByCy('ko-dec-node-10').click();
      cy.getByCy('ko-value-node-10').should('have.text', '1');
    });
  });

  // ── Remove attacker ───────────────────────────────────────────────────────

  it('member can remove an assigned attacker', () => {
    setupAttackerScenario('atk-remove').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
      cy.getByCy('remove-attacker-node-10').click();
      cy.getByCy('attacker-entry-node-10').should('not.exist');
    });
  });

  // ── Assign via UI (click node in Attackers mode) ──────────────────────────

  it('member can assign attacker by clicking a node in Attackers mode', () => {
    setupAttackerScenario('atk-ui').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-node-10').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('be.visible');
      cy.getByCy('attacker-card-Wolverine').should('be.visible').click();
      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
    });
  });

  // ── Node without defender shows warning ──────────────────────────────────

  it('clicking node without defender shows warning toast', () => {
    setupAttackerScenario('atk-warn').then(({ ownerData }) => {
      goToAttackersMode(ownerData.user_id);

      cy.getByCy('war-node-20').scrollIntoView().click({ force: true });
      cy.getByCy('war-attacker-search').should('not.exist');
    });
  });

  // ── x/3 counter visible in panel ─────────────────────────────────────────

  it('attacker panel shows x/3 counter per member', () => {
    setupAttackerScenario('atk-count').then(({ memberData, ownerData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      goToAttackersMode(ownerData.user_id);
      cy.contains('1/3').scrollIntoView().should('be.visible');
    });
  });

  // ── Member sees their own assigned attacks ────────────────────────────────

  it('member can see their own assigned attacks in the attacker panel', () => {
    setupAttackerScenario('atk-member-view').then(({ memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

      // Log in as the member (not the owner/officer)
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');

      cy.getByCy('attacker-entry-node-10').scrollIntoView().should('be.visible');
    });
  });
});
