import { setupOwnerMemberAlliance, setupWarOwner } from '../../support/e2e';

describe('War – Edit', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('officer can edit opponent name', () => {
    setupWarOwner('war-edit-name', 'EditOfficer', 'EditAlliance', 'EA').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'OldEnemy');
        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');

        cy.getByCy('war-opponent-name').should('contain', 'OldEnemy');
        cy.getByCy('edit-war-btn').click();

        cy.getByCy('opponent-name-input').should('have.value', 'OldEnemy').clear().type('NewEnemy');
        cy.getByCy('edit-war-confirm').click();

        cy.getByCy('war-opponent-name').should('contain', 'NewEnemy');
      },
    );
  });

  it('edit dialog is pre-filled with current values', () => {
    setupWarOwner('war-edit-prefill', 'PrefillOfficer', 'PrefillAlliance', 'PA').then(
      ({ ownerData, allianceId }) => {
        cy.apiCreateWar(ownerData.access_token, allianceId, 'PrefilledEnemy');
        cy.apiLogin(ownerData.user_id);
        cy.navTo('war');

        cy.getByCy('edit-war-btn').click();
        cy.getByCy('opponent-name-input').should('have.value', 'PrefilledEnemy');
        cy.getByCy('edit-war-confirm').should('not.be.disabled');
      },
    );
  });

  it('member cannot see the edit button', () => {
    setupOwnerMemberAlliance(
      'war-edit-member',
      'EditOwner',
      'EditMember',
      'EditMemberAlliance',
      'EMA',
    ).then(({ ownerData, memberData, allianceId }) => {
      cy.apiCreateWar(ownerData.access_token, allianceId, 'EnemyAlliance');
      cy.apiLogin(memberData.user_id);
      cy.navTo('war');

      cy.getByCy('war-opponent-name').should('contain', 'EnemyAlliance');
      cy.getByCy('edit-war-btn').should('not.exist');
    });
  });
});
