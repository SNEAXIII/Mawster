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
    setupAttackerScenario('mod1').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      // The note popover only renders on nodes with an assigned attacker.
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
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

        // Show resolved reports: the deletion is now recorded in the note history,
        // and the Delete button is hidden on an already-deleted note.
        cy.getByCy('moderation-status-filter').click();
        cy.getByCy('moderation-status-resolved').click();
        cy.getByCy('moderation-report-row').should('have.length.at.least', 1);
        cy.getByCy('moderation-delete').should('not.exist');
        cy.getByCy('moderation-view-history').first().click();
        cy.getByCy('moderation-revision-deletion').should('exist');
        cy.get('body').type('{esc}');
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
    setupAttackerScenario('mod2').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      writeNoteAsOfficer(ownerData.user_id);
      reportNoteAsMember(memberData.user_id);

      setupAdmin('mod2-admin').then((admin) => {
        openModerationTab(admin.user_id);
        cy.getByCy('moderation-report-row').should('have.length.at.least', 1);
        cy.getByCy('moderation-dismiss').first().click();
        cy.getByCy('confirmation-dialog-confirm').click();
      });

      // Dismiss = whitelisted, so the note stays readable for members
      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-readonly').should('contain.text', NOTE);
    });
  });

  it('restricts note editing to officers and badges noted nodes', () => {
    setupAttackerScenario('mod3').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      writeNoteAsOfficer(ownerData.user_id);

      // A note badge appears on the noted node (close the popover first).
      cy.get('body').type('{esc}');
      cy.getByCy('node-has-note-10').should('exist');

      // A simple member gets a read-only note (no editor) but can still report.
      cy.apiLogin(memberData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-readonly').should('contain.text', NOTE);
      cy.getByCy('war-note-input').should('not.exist');
      cy.getByCy('war-note-report').should('exist');
    });
  });

  it('admin mutes the note author from the revision history; author sees the contextual notice', () => {
    setupAttackerScenario('mod4').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      writeNoteAsOfficer(ownerData.user_id);
      reportNoteAsMember(memberData.user_id);

      setupAdmin('mod4-admin').then((admin) => {
        openModerationTab(admin.user_id);

        // Mute the note author directly from the revision history entry point.
        cy.getByCy('moderation-view-history').first().click();
        cy.getByCy('moderation-revisions-dialog').should('be.visible');
        cy.getByCy('revision-mute').first().click();
        cy.getByCy('moderation-reason-input').type('Inappropriate note');
        cy.getByCy('moderation-mute-confirm').click();

        // Close the history dialog; the mute now shows in the mutes table.
        cy.get('body').type('{esc}');
        cy.getByCy('mutes-table').should('contain.text', 'Inappropriate note');
        // The "By" column records which admin issued the mute.
        cy.getByCy('mute-row').first().should('contain.text', admin.login);
      });

      // The muted author sees the contextual notice and can neither edit nor report.
      cy.apiLogin(ownerData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-mute-notice').should('be.visible');
      cy.getByCy('war-note-save').should('be.disabled');
      cy.getByCy('war-note-report').should('be.disabled');
    });
  });

  it('muted officer cannot delete any note', () => {
    setupAttackerScenario('mod4b').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      writeNoteAsOfficer(ownerData.user_id);
      reportNoteAsMember(memberData.user_id);

      setupAdmin('mod4b-admin').then((admin) => {
        openModerationTab(admin.user_id);
        cy.getByCy('moderation-view-history').first().click();
        cy.getByCy('moderation-revisions-dialog').should('be.visible');
        cy.getByCy('revision-mute').first().click();
        cy.getByCy('moderation-reason-input').type('Inappropriate note');
        cy.getByCy('moderation-mute-confirm').click();
      });

      // The muted officer sees the notice and the delete button is disabled.
      cy.apiLogin(ownerData.user_id);
      cy.visit('/game/war');
      cy.getByCy('war-attacker-panel').scrollIntoView().should('be.visible');
      cy.getByCy('node-actions-trigger-node-10').click();
      cy.getByCy('war-note-mute-notice').should('be.visible');
      cy.getByCy('war-note-delete').should('be.disabled');
    });
  });

  it('admin warns the note author from history; the reason field is capped at 500', () => {
    setupAttackerScenario('mod5').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      writeNoteAsOfficer(ownerData.user_id);
      reportNoteAsMember(memberData.user_id);

      setupAdmin('mod5-admin').then((admin) => {
        openModerationTab(admin.user_id);

        // Warn the note author straight from the revision history.
        cy.getByCy('moderation-view-history').first().click();
        cy.getByCy('moderation-revisions-dialog').should('be.visible');
        cy.getByCy('revision-warn').first().click();
        // The moderation reason is bounded to 500 characters.
        cy.getByCy('moderation-reason-input').should('have.attr', 'maxlength', '500');
        cy.getByCy('moderation-reason-input').type('Please keep notes factual');
        cy.getByCy('moderation-warn-confirm').click();

        // Close the history dialog; the warn shows in the warns table with its author.
        cy.get('body').type('{esc}');
        cy.getByCy('warns-table').should('contain.text', 'Please keep notes factual');
        cy.getByCy('warn-row').first().should('contain.text', admin.login);
      });
    });
  });

  it('deletion history entries expose no moderation buttons; editable revisions do', () => {
    setupAttackerScenario('mod6').then(({ ownerData, memberData, allianceId, warId, championUserId }) => {
      cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);
      writeNoteAsOfficer(ownerData.user_id);

      // Edit the note so a non-deletion revision exists alongside the future deletion.
      cy.getByCy('war-note-input').clear().type('Edited note content');
      cy.getByCy('war-note-save').click();

      reportNoteAsMember(memberData.user_id);

      setupAdmin('mod6-admin').then((admin) => {
        openModerationTab(admin.user_id);
        cy.getByCy('moderation-delete').first().click();
        cy.getByCy('confirmation-dialog-confirm').click();

        cy.getByCy('moderation-status-filter').click();
        cy.getByCy('moderation-status-resolved').click();
        cy.getByCy('moderation-view-history').first().click();

        // The deletion marker offers no mute/warn — you cannot moderate a deletion.
        cy.getByCy('moderation-revision-deletion').should('exist').within(() => {
          cy.getByCy('revision-mute').should('not.exist');
          cy.getByCy('revision-warn').should('not.exist');
        });
        // An editable revision still offers both moderation actions.
        cy.getByCy('moderation-revision-row').first().within(() => {
          cy.getByCy('revision-mute').should('exist');
          cy.getByCy('revision-warn').should('exist');
        });
      });
    });
  });
});
