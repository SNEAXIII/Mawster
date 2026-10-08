import { setupOwnerMemberAlliance } from '../../support/e2e';

describe('Alliances – Renaming', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('owner renames the alliance name and tag', () => {
    setupOwnerMemberAlliance('rename', 'RenOwner', 'RenMember', 'OldName', 'OLD').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'alliances');

      cy.getByCy('alliance-card-OldName').within(() => {
        cy.getByCy('alliance-rename-toggle').click();
      });
      cy.getByCy('confirmation-dialog-confirm').should('be.disabled');
      cy.getByCy('alliance-rename-name-input').clear();
      cy.getByCy('alliance-rename-name-input').type('NewName');
      cy.getByCy('alliance-rename-tag-input').clear();
      cy.getByCy('alliance-rename-tag-input').type('NEW');
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.getByCy('alliance-card-NewName').within(() => {
        cy.getByCy('alliance-tag').should('contain.text', 'NEW');
      });
      cy.reload();
      cy.get('[data-cy="alliance-card-NewName"] [data-cy="alliance-tag"]').should('contain.text', 'NEW');
    });
  });

  it('caps the name at 25 characters and the tag at 5 in the rename dialog', () => {
    setupOwnerMemberAlliance('rename-max', 'MaxOwner', 'MaxMember', 'MaxName', 'MAX').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id, 'alliances');

      cy.getByCy('alliance-card-MaxName').within(() => {
        cy.getByCy('alliance-rename-toggle').click();
      });
      cy.getByCy('alliance-rename-name-input').clear();
      cy.getByCy('alliance-rename-name-input').type('B'.repeat(30));
      cy.getByCy('alliance-rename-name-input').should('have.value', 'B'.repeat(25));
      cy.getByCy('alliance-rename-tag-input').clear();
      cy.getByCy('alliance-rename-tag-input').type('ABCDEFG');
      cy.getByCy('alliance-rename-tag-input').should('have.value', 'ABCDE');
      cy.getByCy('confirmation-dialog-confirm').click();

      cy.getByCy(`alliance-card-${'B'.repeat(25)}`).within(() => {
        cy.getByCy('alliance-tag').should('contain.text', 'ABCDE');
      });
    });
  });

  it('a plain member does not see the rename button', () => {
    setupOwnerMemberAlliance('rename-ro', 'RnOwner', 'RnMember', 'RoName', 'RO').then(({ memberData }) => {
      cy.apiLogin(memberData.user_id, 'alliances');

      cy.getByCy('alliance-card-RoName').within(() => {
        cy.getByCy('alliance-name').should('be.visible');
        cy.get('[data-cy="alliance-rename-toggle"]').should('not.exist');
      });
    });
  });
});
