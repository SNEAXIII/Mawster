import { setupWarOwner } from '../../support/e2e';

// Column indices (0-based) — see display.cy.ts:
// 0: Player | 1: Attacker | 2: Defender | 3: Synergies | 4: Prefights | 5: Node | 6: Tier | 7: KO | 8: Alliance | 9: Date

describe('Knowledge Base – CSV Import combined records', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('imports a CSV without header row and shows the record in the knowledge base', () => {
    setupWarOwner('csv-nohdr', 'NoHdrUser', 'NoHdrAlliance', 'NHD').then(
      ({ adminData, ownerData }) => {
        cy.apiCreateSeason(adminData.access_token, 1).then(() => {
          cy.apiLoadChampion(adminData.access_token, 'Magik', 'Mystic').then(() => {
            cy.apiLoadChampion(adminData.access_token, 'Serpent', 'Cosmic').then(() => {
              cy.apiLogin(ownerData.user_id);
              cy.visit('/game/knowledge-base/import');

              // No header line, ko_count present
              const csv = `Magik,Serpent,15,S1,2\n`;
              cy.getByCy('csv-file-input').selectFile({
                contents: Cypress.Buffer.from(csv),
                fileName: 'fights.csv',
                mimeType: 'text/csv',
              });

              cy.getByCy('import-confirm-btn').should('not.be.disabled').click();
              cy.contains('fight records').should('be.visible');

              cy.visit('/game/knowledge-base');
              cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);
              cy.getByCy('fight-records-table').within(() => {
                cy.get('tbody tr')
                  .first()
                  .within(() => {
                    cy.get('td').eq(1).should('contain.text', 'Magik');
                    cy.get('td').eq(2).should('contain.text', 'Serpent');
                    cy.get('td').eq(5).should('contain.text', '15');
                    cy.get('td').eq(7).should('have.text', '2');
                  });
              });
            });
          });
        });
      },
    );
  });

  it('defaults ko_count to 0 when the column is left empty', () => {
    setupWarOwner('csv-emptyko', 'EmptyKoUser', 'EmptyKoAlliance', 'EKO').then(
      ({ adminData, ownerData }) => {
        cy.apiCreateSeason(adminData.access_token, 1).then(() => {
          cy.apiLoadChampion(adminData.access_token, 'Magik', 'Mystic').then(() => {
            cy.apiLoadChampion(adminData.access_token, 'Serpent', 'Cosmic').then(() => {
              cy.apiLogin(ownerData.user_id);
              cy.visit('/game/knowledge-base/import');

              // Header present, trailing empty ko_count
              const csv = `attacker,defender,node,season,ko_count\nMagik,Serpent,20,S1,\n`;
              cy.getByCy('csv-file-input').selectFile({
                contents: Cypress.Buffer.from(csv),
                fileName: 'fights.csv',
                mimeType: 'text/csv',
              });

              cy.getByCy('import-confirm-btn').should('not.be.disabled').click();
              cy.contains('fight records').should('be.visible');

              cy.visit('/game/knowledge-base');
              cy.getByCy('fight-records-table')
                .find('tbody tr')
                .first()
                .within(() => {
                  cy.get('td').eq(5).should('contain.text', '20');
                  cy.get('td').eq(7).should('have.text', '0');
                });
            });
          });
        });
      },
    );
  });

  it('combines multiple imported rows from one CSV in the knowledge base', () => {
    setupWarOwner('csv-combine', 'CombineUser', 'CombineAlliance', 'CMB').then(
      ({ adminData, ownerData }) => {
        cy.apiCreateSeason(adminData.access_token, 1).then(() => {
          cy.apiLoadChampion(adminData.access_token, 'Magik', 'Mystic').then(() => {
            cy.apiLoadChampion(adminData.access_token, 'Serpent', 'Cosmic').then(() => {
              cy.apiLoadChampion(adminData.access_token, 'Doom', 'Mystic').then(() => {
                cy.apiLogin(ownerData.user_id);
                cy.visit('/game/knowledge-base/import');

                // Mixed: one row with ko_count, one with empty ko_count, no header
                const csv = `Magik,Serpent,15,S1,2\nDoom,Serpent,16,S1,\n`;
                cy.getByCy('csv-file-input').selectFile({
                  contents: Cypress.Buffer.from(csv),
                  fileName: 'fights.csv',
                  mimeType: 'text/csv',
                });

                cy.getByCy('import-confirm-btn').should('not.be.disabled').click();
                cy.contains('fight records').should('be.visible');

                cy.visit('/game/knowledge-base');
                cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
                cy.getByCy('fight-records-table').should('contain.text', 'Magik');
                cy.getByCy('fight-records-table').should('contain.text', 'Doom');

                // Only imported records exist — source filter keeps them
                cy.getByCy('filter-source-trigger').click();
                cy.getByCy('filter-source-imported').click();
                cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

                cy.getByCy('filter-source-trigger').click();
                cy.getByCy('filter-source-non-imported').click();
                cy.getByCy('fight-records-table').should(
                  'contain.text',
                  'No fight records found.',
                );
              });
            });
          });
        });
      },
    );
  });

  it('excludes imported records when filtering by player pseudo', () => {
    setupWarOwner('csv-player', 'PlayerUser', 'PlayerAlliance', 'PLY').then(
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

                // Imported record is visible with no player filter
                cy.getByCy('fight-records-table').should('contain.text', 'Magik');

                // Imported records have no game account → a player filter must exclude them
                cy.getByCy('filter-player').type('Player');
                cy.getByCy('fight-records-table').should(
                  'contain.text',
                  'No fight records found.',
                );
              });
            });
          });
        });
      },
    );
  });
});
