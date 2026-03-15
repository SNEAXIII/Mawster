import { setupOwnerMemberAlliance, setupUser } from '../../support/e2e';

describe('Alliances – Member Groups', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Group headers ──────────────────────────────────────────────────────────

  it('displays all four group column headers', () => {
    setupOwnerMemberAlliance('grp-headers', 'HdrOwner', 'HdrMember', 'HdrAlliance', 'HD').then(
      ({ ownerData }) => {
        cy.uiLogin(ownerData.login);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-HdrAlliance').within(() => {
          cy.getByCy('group-col-1').should('exist');
          cy.getByCy('group-col-2').should('exist');
          cy.getByCy('group-col-3').should('exist');
          cy.getByCy('group-col-unassigned').should('exist');
        });
      }
    );
  });

  // ── Member placement by group ──────────────────────────────────────────────

  it('places members in the correct group column after assignment', () => {
    setupOwnerMemberAlliance(
      'grp-placement',
      'PlaceOwner',
      'PlaceMember',
      'PlaceAlliance',
      'PL'
    ).then(({ ownerData, allianceId, ownerAccId, memberAccId }) => {
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 2);

      cy.uiLogin(ownerData.login);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-PlaceAlliance').within(() => {
        cy.getByCy('group-col-1').find('[data-cy="member-row-PlaceOwner"]').should('exist');
        cy.getByCy('group-col-2').find('[data-cy="member-row-PlaceMember"]').should('exist');
        cy.getByCy('group-col-unassigned')
          .find('[data-cy="member-row-PlaceOwner"]')
          .should('not.exist');
        cy.getByCy('group-col-unassigned')
          .find('[data-cy="member-row-PlaceMember"]')
          .should('not.exist');
      });
    });
  });

  it('shows unassigned member under the No group column by default', () => {
    setupOwnerMemberAlliance(
      'grp-nogroup',
      'NoGrpOwner',
      'NoGrpMember',
      'NoGrpAlliance',
      'NG'
    ).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-NoGrpAlliance').within(() => {
        cy.getByCy('group-col-unassigned')
          .find('[data-cy="member-row-NoGrpOwner"]')
          .should('exist');
        cy.getByCy('group-col-unassigned')
          .find('[data-cy="member-row-NoGrpMember"]')
          .should('exist');
      });
    });
  });

  it('moves member to No group column when group is cleared', () => {
    setupOwnerMemberAlliance('grp-clear', 'ClearOwner', 'ClearMember', 'ClearAlliance', 'CL').then(
      ({ ownerData, allianceId, memberAccId }) => {
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 3);
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, null);

        cy.uiLogin(ownerData.login);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-ClearAlliance').within(() => {
          cy.getByCy('group-col-3').find('[data-cy="member-row-ClearMember"]').should('not.exist');
          cy.getByCy('group-col-unassigned')
            .find('[data-cy="member-row-ClearMember"]')
            .should('exist');
        });
      }
    );
  });

  // ── Group picker availability ──────────────────────────────────────────────

  it('group picker shows all three groups when none are full', () => {
    setupOwnerMemberAlliance(
      'grp-picker-all',
      'PickerOwner',
      'PickerMember',
      'PickerAlliance',
      'PK'
    ).then(({ ownerData }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-PickerAlliance').within(() => {
        cy.getByCy('member-row-PickerMember').find('[data-cy="member-group-select"]').click();
      });

      cy.get('[role="option"]').contains('Group 1').should('exist');
      cy.get('[role="option"]').contains('Group 2').should('exist');
      cy.get('[role="option"]').contains('Group 3').should('exist');
    });
  });

  it('group picker hides a group that is full (10 members)', () => {
    setupUser('grp-full-owner').then((ownerData) => {
      cy.apiCreateGameAccount(ownerData.access_token, 'FullOwner', true).then((ownerAcc) => {
        cy.apiCreateAlliance(ownerData.access_token, 'FullAlliance', 'FL', ownerAcc.id).then(
          (alliance) => {
            const allianceId = alliance.id;

            // Owner assigned to group 1 (1/10)
            cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAcc.id, 1);

            // Create the target member (will be unassigned, used to check picker)
            cy.registerUser('grp-full-target').then((targetData) => {
              cy.apiCreateGameAccount(targetData.access_token, 'FullTarget', true).then(
                (targetAcc) => {
                  cy.apiForceJoinAlliance(targetAcc.id, allianceId);
                }
              );
            });

            // Create 9 extra members and fill group 1 (total: 10)
            Array.from({ length: 9 }, (_, i) => i).forEach((i) => {
              cy.registerUser(`grp-full-extra${i}`).then((extraData) => {
                cy.apiCreateGameAccount(extraData.access_token, `FullExtra${i}`, true).then(
                  (extraAcc) => {
                    cy.apiForceJoinAlliance(extraAcc.id, allianceId);
                    cy.apiSetMemberGroup(ownerData.access_token, allianceId, extraAcc.id, 1);
                  }
                );
              });
            });

            cy.uiLogin(ownerData.login);
            cy.navTo('alliances');

            cy.getByCy('alliance-card-FullAlliance').within(() => {
              cy.getByCy('member-row-FullTarget').find('[data-cy="member-group-select"]').click();
            });

            // Group 1 is full — option must not appear
            cy.get('[role="option"]').contains('Group 1').should('not.exist');
            // Group 2 and 3 are still available
            cy.get('[role="option"]').contains('Group 2').should('exist');
            cy.get('[role="option"]').contains('Group 3').should('exist');
          }
        );
      });
    });
  });

  it('group picker keeps current group visible even if it is full', () => {
    setupUser('grp-keep-owner').then((ownerData) => {
      cy.apiCreateGameAccount(ownerData.access_token, 'KeepOwner', true).then((ownerAcc) => {
        cy.apiCreateAlliance(ownerData.access_token, 'KeepAlliance', 'KP', ownerAcc.id).then(
          (alliance) => {
            const allianceId = alliance.id;

            // Owner assigned to group 1
            cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAcc.id, 1);

            // Create 9 extra members to fill group 1 (total: 10 with owner)
            Array.from({ length: 9 }, (_, i) => i).forEach((i) => {
              cy.registerUser(`grp-keep-extra${i}`).then((extraData) => {
                cy.apiCreateGameAccount(extraData.access_token, `KeepExtra${i}`, true).then(
                  (extraAcc) => {
                    cy.apiForceJoinAlliance(extraAcc.id, allianceId);
                    cy.apiSetMemberGroup(ownerData.access_token, allianceId, extraAcc.id, 1);
                  }
                );
              });
            });

            cy.uiLogin(ownerData.login);
            cy.navTo('alliances');

            // Owner is already in group 1 — picker should still show Group 1
            cy.getByCy('alliance-card-KeepAlliance').within(() => {
              cy.getByCy('member-row-KeepOwner').find('[data-cy="member-group-select"]').click();
            });

            cy.get('[role="option"]').contains('Group 1').should('exist');
          }
        );
      });
    });
  });
});
