import { setupAttackerScenario, setupAdmin } from '../../support/e2e';

const NOTE = 'Suspicious note content';

/** Officer writes a note on node 10 via the war-map popover. */
function writeNoteAsOfficer(officerUserId: string) {
  cy.apiLogin(officerUserId);
  cy.visit('/game/war');
  cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
  cy.getByCy('node-actions-trigger-node-10').click();
  cy.getByCy('war-note-input').type(NOTE);
  cy.getByCy('war-note-save').click();
}

/** A reader reports the note on node 10. */
function reportNoteAsMember(memberUserId: string) {
  cy.apiLogin(memberUserId);
  cy.visit('/game/war');
  cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
  cy.getByCy('node-actions-trigger-node-10').click();
  cy.getByCy('war-note-report').click();
  cy.getByCy('war-note-report').should('be.disabled');
}

function openModerationTab(adminUserId: string) {
  cy.apiLogin(adminUserId);
  cy.visit('/admin');
  cy.getByCy('tab-moderation').click();
  cy.getByCy('moderation-reports-table').should('be.visible');
}

describe('War note moderation', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('member reports a note; admin reviews history then deletes it', () => {
    setupAttackerScenario('mod1').then(({ ownerData, memberData }) => {
      writeNoteAsOfficer(ownerData.user_id);
      reportNoteAsMember(memberData.user_id);

      setupAdmin('mod1-admin').then((admin) => {
        openModerationTab(admin.user_id);

        cy.getByCy('moderation-report-row').should('have.length.at.least', 1);

        // Review the edit history (admin-only) — the original note content is visible
        cy.getByCy('moderation-view-history').first().click();
        cy.getByCy('moderation-revisions-dialog').should('contain.text', NOTE);
        cy.get('body').type('{esc}');

        // Delete the note (destructive → confirmation dialog)
        cy.getByCy('moderation-delete').first().click();
        cy.getByCy('confirmation-dialog-confirm').click();
      });

      // The note is gone for the member afterwards
      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-readonly').should('not.exist');
    });
  });

  it('admin dismiss keeps the note visible to members', () => {
    setupAttackerScenario('mod2').then(({ ownerData, memberData }) => {
      writeNoteAsOfficer(ownerData.user_id);
      reportNoteAsMember(memberData.user_id);

      setupAdmin('mod2-admin').then((admin) => {
        openModerationTab(admin.user_id);
        cy.getByCy('moderation-report-row').should('have.length.at.least', 1);
        cy.getByCy('moderation-dismiss').first().click();
      });

      // Dismiss = whitelisted, so the note stays readable for members
      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-readonly').should('contain.text', NOTE);
    });
  });

  // TODO: mute/warn + moderation-banner coverage.
  // The mutes/warns admin UI keys its "mute" action off existing warn rows and its "warn"
  // action off existing mute rows, so the first mute/warn cannot be initiated from a clean
  // panel. Covering the banner (data-cy="moderation-banner" / "moderation-mute" /
  // "moderation-warn") needs either a backend seed helper for muted/warned state or a
  // standalone "moderate user" entry point in the admin users panel. The backend flow is
  // already covered by api/tests/integration/endpoints/admin/moderation_test.py
  // (test_me_moderation_reports_mute_and_warns, test_admin_mute_and_warn_endpoints).
});
