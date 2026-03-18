import { setupWarOwner, setupUser } from '../../support/e2e';

describe('War – Management tab (declare & end war)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Tab visibility ────────────────────────────────────────────────────────

  it('management tab is the default for officers', () => {
    setupWarOwner('war-mgmt-default', 'DefaultOfficer', 'DefaultAlliance', 'DA').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        cy.getByCy('tab-war-management').should('have.class', 'border-blue-600');
      }
    );
  });

  // ── Declare war ───────────────────────────────────────────────────────────

  it('officer can declare a war from the management tab', () => {
    setupWarOwner('war-mgmt-declare', 'DeclareOfficer', 'DeclareAlliance', 'DL').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('war');

        cy.getByCy('declare-war-btn').should('be.visible').click();
        cy.getByCy('opponent-name-input').type('Nemesis');
        cy.getByCy('create-war-confirm').click();

        cy.contains('War declared against Nemesis').should('be.visible');
        cy.getByCy('war-select').should('contain', 'vs Nemesis');
      }
    );
  });

  it('declare war button is not visible for non-officers', () => {
    setupWarOwner('war-mgmt-nodeclare', 'NoDeclareOwner', 'NoDeclareAlliance', 'ND').then(
      ({ allianceId }) => {
        setupUser('war-mgmt-nodeclare-member').then((memberData) => {
          cy.apiCreateGameAccount(memberData.access_token, 'JustAMember', true).then((acc) => {
            cy.apiForceJoinAlliance(acc.id, allianceId).then(() => {
              cy.uiLogin(memberData.login);
              cy.navTo('war');
              cy.getByCy('declare-war-btn').should('not.exist');
            });
          });
        });
      }
    );
  });

  // ── End war ───────────────────────────────────────────────────────────────

  it('officer can end an active war with confirmation', () => {
    setupWarOwner('war-mgmt-end', 'EndOfficer', 'EndAlliance', 'EA').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'EndEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          cy.getByCy('war-select').click();
          cy.getByCy('war-option-EndEnemy').click();

          cy.getByCy('end-war-btn').should('be.visible').click();
          cy.getByCy('confirmation-dialog-confirm').click();

          cy.contains('War ended successfully').should('be.visible');
        });
      }
    );
  });

  it('ended war shows checkmark in the selector', () => {
    setupWarOwner('war-mgmt-check', 'CheckOfficer', 'CheckAlliance', 'CK').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'CheckEnemy').then((war) => {
          cy.apiEndWar(ownerData.access_token, allianceId, war.id);

          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          cy.getByCy('war-select').should('contain', '✓');
        });
      }
    );
  });

  it('end war button is hidden for already-ended wars', () => {
    setupWarOwner('war-mgmt-noend', 'NoEndOfficer', 'NoEndAlliance', 'NE').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'AlreadyDone').then((war) => {
          cy.apiEndWar(ownerData.access_token, allianceId, war.id);

          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          cy.getByCy('war-select').click();
          cy.getByCy('war-option-AlreadyDone').click();

          cy.getByCy('end-war-btn').should('not.exist');
        });
      }
    );
  });

  it('end war preserves placements (defenders still visible in defenders tab)', () => {
    setupWarOwner('war-mgmt-history', 'HistoryOfficer', 'HistoryAlliance', 'HI').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Captain America', 'Science').then((champs) => {
          cy.apiCreateWar(ownerData.access_token, allianceId, 'HistoryEnemy').then((war) => {
            cy.apiPlaceWarDefender(ownerData.access_token, allianceId, war.id, 1, 3, champs[0].id, 7, 3);

            cy.uiLogin(ownerData.login);
            cy.navTo('war');

            // End the war
            cy.getByCy('war-select').click();
            cy.getByCy('war-option-HistoryEnemy').click();
            cy.getByCy('end-war-btn').click();
            cy.getByCy('confirmation-dialog-confirm').click();
            cy.contains('War ended successfully').should('be.visible');

            // Switch to defenders tab — node 3 should still show the placed champion
            cy.getByCy('tab-war-defenders').click();
            cy.getByCy('war-node-3').should('not.contain', '+');
          });
        });
      }
    );
  });

  it('declare war button is disabled when an active war already exists', () => {
    setupWarOwner('war-mgmt-onlyone', 'OnlyOneOfficer', 'OnlyOneAlliance', 'OO').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ActiveEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');
          cy.getByCy('declare-war-btn').should('be.disabled');
        });
      }
    );
  });

  it('declare war button is re-enabled after ending the active war', () => {
    setupWarOwner('war-mgmt-reenable', 'ReEnableOfficer', 'ReEnableAlliance', 'RE').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'ToEndEnemy').then((war) => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          // Button disabled while war is active
          cy.getByCy('declare-war-btn').should('be.disabled');

          // End the war
          cy.getByCy('war-select').click();
          cy.getByCy('war-option-ToEndEnemy').click();
          cy.getByCy('end-war-btn').click();
          cy.getByCy('confirmation-dialog-confirm').click();
          cy.contains('War ended successfully').should('be.visible');

          // Button enabled again
          cy.getByCy('declare-war-btn').should('not.be.disabled');
        });
      }
    );
  });

  it('cancelling end-war dialog does not end the war', () => {
    setupWarOwner('war-mgmt-cancel', 'CancelOfficer', 'CancelAlliance', 'CA').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'CancelEnemy').then(() => {
          cy.uiLogin(ownerData.login);
          cy.navTo('war');

          cy.getByCy('war-select').click();
          cy.getByCy('war-option-CancelEnemy').click();

          cy.getByCy('end-war-btn').click();
          // Click cancel instead of confirm
          cy.getByCy('confirmation-dialog-cancel').click();

          // War should still be active — end-war-btn still visible
          cy.getByCy('end-war-btn').should('be.visible');
          cy.getByCy('war-select').should('not.contain', '✓');
        });
      }
    );
  });
});
