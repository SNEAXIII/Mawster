import { setupWarOwner } from '../../support/e2e';

describe('Knowledge Base – CSV Import', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('shows champion resolution UI for unknown names', () => {
    setupWarOwner('csv-res', 'ResUser', 'ResAlliance', 'RES').then(({ ownerData }) => {
      cy.apiLogin(ownerData.user_id);
      cy.visit('/game/knowledge-base/import');

      const csv = `attacker,defender,node,season,ko_count\nUnknownHero,AnotherHero,15,S1,0\n`;
      cy.getByCy('csv-file-input').selectFile({
        contents: Cypress.Buffer.from(csv),
        fileName: 'fights.csv',
        mimeType: 'text/csv',
      });

      cy.getByCy('import-confirm-btn').should('be.disabled');
      cy.contains('Resolve unknown champions').should('be.visible');
    });
  });

  it('imports a valid CSV and shows success toast', () => {
    setupWarOwner('csv-ok', 'OkUser', 'OkAlliance', 'OK').then(({ adminData, ownerData }) => {
      cy.apiCreateSeason(adminData.access_token, 1).then(() => {
        cy.apiLoadChampion(adminData.access_token, 'Magik', 'Mystic').then(() => {
          cy.apiLoadChampion(adminData.access_token, 'Serpent', 'Cosmic').then(() => {
            cy.apiLogin(ownerData.user_id);
            cy.visit('/game/knowledge-base/import');

            const csv = `attacker,defender,node,season,ko_count\nMagik,Serpent,15,S1,2\n`;
            cy.getByCy('csv-file-input').selectFile({
              contents: Cypress.Buffer.from(csv),
              fileName: 'fights.csv',
              mimeType: 'text/csv',
            });

            cy.getByCy('import-confirm-btn').should('not.be.disabled').click();
            cy.contains('fight records').should('be.visible');
          });
        });
      });
    });
  });

  it('filters knowledge base to imported records only', () => {
    setupWarOwner('csv-filter', 'FilterUser', 'FilterAlliance', 'FLT').then(
      ({ adminData, ownerData, allianceId }) => {
        cy.apiCreateSeason(adminData.access_token, 1).then(() => {
          cy.apiLoadChampion(adminData.access_token, 'Magik', 'Mystic').then(([attacker]) => {
            cy.apiLoadChampion(adminData.access_token, 'Serpent', 'Cosmic').then(([defender]) => {
              cy.apiImportFightRecords(ownerData.access_token, allianceId, [
                {
                  champion_id: attacker.id,
                  defender_champion_id: defender.id,
                  node_number: 15,
                  season_name: 'S1',
                  ko_count: 2,
                },
              ]).then(() => {
                cy.apiLogin(ownerData.user_id);
                cy.visit('/game/knowledge-base');
                cy.getByCy('filter-source-trigger').click();
                cy.getByCy('filter-source-imported').click();
                cy.contains('Magik').should('be.visible');

                cy.getByCy('filter-source-trigger').click();
                cy.getByCy('filter-source-non-imported').click();
                cy.contains('Magik').should('not.exist');
              });
            });
          });
        });
      },
    );
  });
});
