import { setupOwnerMemberAlliance } from '../../support/e2e';

function createAndJoinMember(prefix: string, pseudo: string, allianceId: string) {
  cy.registerUser(prefix).then((targetData) => {
    cy.apiCreateGameAccount(targetData.access_token, pseudo, true).then((targetAcc) => {
      cy.apiForceJoinAlliance(targetAcc.id, allianceId);
    });
  });
}

function fillGroupOneWith9Members(allianceId: string, ownerToken: string, prefix: string) {
  Array.from({ length: 9 }, (_, i) => i).forEach((i) => {
    cy.registerUser(`${prefix}${i}`).then((extraData) => {
      cy.apiCreateGameAccount(extraData.access_token, `${prefix.replace(/-/g, '').slice(0, 8)}Ext${i}`.slice(0, 16), true).then(
        (extraAcc) => {
          cy.apiForceJoinAlliance(extraAcc.id, allianceId);
          cy.apiSetMemberGroup(ownerToken, allianceId, extraAcc.id, 1);
        },
      );
    });
  });
}

describe('Alliances – Member Groups', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Group headers ──────────────────────────────────────────────────────────

  it('displays all four group column headers', () => {
    setupOwnerMemberAlliance('grp-headers', 'HdrOwner', 'HdrMember', 'HdrAlliance', 'HD').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-HdrAlliance').within(() => {
        cy.getByCy('group-col-1').should('exist');
        cy.getByCy('group-col-2').should('exist');
        cy.getByCy('group-col-3').should('exist');
        cy.getByCy('group-col-unassigned').should('exist');
      });
    });
  });

  // ── Member placement by group ──────────────────────────────────────────────

  it('places members in the correct group column after assignment', () => {
    setupOwnerMemberAlliance('grp-placement', 'PlaceOwner', 'PlaceMember', 'PlaceAlliance', 'PL').then(
      ({ ownerData, allianceId, ownerAccId, memberAccId }) => {
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 2);

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-PlaceAlliance').within(() => {
          cy.getByCy('group-col-1').find('[data-cy="member-row-PlaceOwner"]').should('exist');
          cy.getByCy('group-col-2').find('[data-cy="member-row-PlaceMember"]').should('exist');
          cy.getByCy('group-col-unassigned').find('[data-cy="member-row-PlaceOwner"]').should('not.exist');
          cy.getByCy('group-col-unassigned').find('[data-cy="member-row-PlaceMember"]').should('not.exist');
        });
      },
    );
  });

  it('shows unassigned member under the No group column by default', () => {
    setupOwnerMemberAlliance('grp-nogroup', 'NoGrpOwner', 'NoGrpMember', 'NoGrpAlliance', 'NG').then(
      ({ ownerData }) => {
        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-NoGrpAlliance').within(() => {
          cy.getByCy('group-col-unassigned').find('[data-cy="member-row-NoGrpOwner"]').should('exist');
          cy.getByCy('group-col-unassigned').find('[data-cy="member-row-NoGrpMember"]').should('exist');
        });
      },
    );
  });

  it('moves member to No group column when group is cleared', () => {
    setupOwnerMemberAlliance('grp-clear', 'ClearOwner', 'ClearMember', 'ClearAlliance', 'CL').then(
      ({ ownerData, allianceId, memberAccId }) => {
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 3);
        cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, null);

        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-ClearAlliance').within(() => {
          cy.getByCy('group-col-3').find('[data-cy="member-row-ClearMember"]').should('not.exist');
          cy.getByCy('group-col-unassigned').find('[data-cy="member-row-ClearMember"]').should('exist');
        });
      },
    );
  });

  // ── Group picker availability ──────────────────────────────────────────────

  it('group picker shows all three groups when none are full', () => {
    setupOwnerMemberAlliance('grp-picker-all', 'PickerOwner', 'PickerMember', 'PickerAlliance', 'PK').then(
      ({ ownerData }) => {
        cy.apiLogin(ownerData.user_id);
        cy.navTo('alliances');

        cy.getByCy('alliance-card-PickerAlliance').within(() => {
          cy.getByCy('member-row-PickerMember').find('[data-cy="member-group-select"]').click();
        });

        cy.get('[role="option"]').contains('G1').should('exist');
        cy.get('[role="option"]').contains('G2').should('exist');
        cy.get('[role="option"]').contains('G3').should('exist');
      },
    );
  });

  it('group picker hides a group that is full (10 members)', () => {
    cy.apiBatchSetup([
      {
        discord_token: 'grp-full-owner',
        game_pseudo: 'FullOwner',
        create_alliance: { name: 'FullAlliance', tag: 'FL' },
      },
    ]).then((users) => {
      const ownerData = users['grp-full-owner'];
      const allianceId = ownerData.alliance_id!;
      const ownerAccId = ownerData.account_id!;

      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      createAndJoinMember('grp-full-target', 'FullTarget', allianceId);
      fillGroupOneWith9Members(allianceId, ownerData.access_token, 'grp-full-extra');

      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-FullAlliance').within(() => {
        cy.getByCy('member-row-FullTarget').find('[data-cy="member-group-select"]').click();
      });

      cy.get('[role="option"]').contains('G1').should('not.exist');
      cy.get('[role="option"]').contains('G2').should('exist');
      cy.get('[role="option"]').contains('G3').should('exist');
    });
  });

  it('group picker keeps current group visible even if it is full', () => {
    cy.apiBatchSetup([
      {
        discord_token: 'grp-keep-owner',
        game_pseudo: 'KeepOwner',
        create_alliance: { name: 'KeepAlliance', tag: 'KP' },
      },
    ]).then((users) => {
      const ownerData = users['grp-keep-owner'];
      const allianceId = ownerData.alliance_id!;
      const ownerAccId = ownerData.account_id!;

      cy.apiSetMemberGroup(ownerData.access_token, allianceId, ownerAccId, 1);
      fillGroupOneWith9Members(allianceId, ownerData.access_token, 'grp-keep-extra');

      cy.apiLogin(ownerData.user_id);
      cy.navTo('alliances');

      cy.getByCy('alliance-card-KeepAlliance').within(() => {
        cy.getByCy('member-row-KeepOwner').find('[data-cy="member-group-select"]').click();
      });

      cy.get('[role="option"]').contains('G1').should('exist');
    });
  });
});
