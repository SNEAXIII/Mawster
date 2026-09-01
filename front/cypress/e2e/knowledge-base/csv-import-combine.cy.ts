import { setupWarOwner } from '../../support/e2e';

// Column indices (0-based) — see display.cy.ts:
// 0: Player | 1: Attacker | 2: Defender | 3: Synergies | 4: Prefights | 5: Node | 6: KO | 7: Alliance | 8: Season | 9: Tier | 10: Date | 11: Note

// The attacker/defender pair the CSV rows reference in most of these tests.
const MAGIK_AND_SERPENT: Array<[string, string]> = [
  ['Magik', 'Mystic'],
  ['Serpent', 'Cosmic'],
];

describe('Knowledge Base – CSV Import combined records', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // Alliance owner + season 1 + the champions the CSV rows reference. `champions`
  // fills in while the queued commands run, so it is only readable inside .then().
  function setupImportScenario(
    prefix: string,
    pseudo: string,
    allianceName: string,
    tag: string,
    champions: Array<[string, string]>,
  ) {
    return setupWarOwner(prefix, pseudo, allianceName, tag).then(({ adminData, ownerData, allianceId }) => {
      const loaded: Record<string, { id: string }> = {};
      cy.apiCreateSeason(adminData.access_token, 1);
      champions.forEach(([name, cls]) => {
        cy.apiLoadChampion(adminData.access_token, name, cls).then(([champ]: { id: string }[]) => {
          loaded[name] = champ;
        });
      });
      return cy.wrap({ ownerData, allianceId, champions: loaded }, { log: false });
    });
  }

  // Log in on the import page, push the CSV through, then land on the knowledge
  // base — every import test asserts on the records from there.
  function importCsvAs(userId: string, csv: string) {
    cy.apiLogin(userId, 'knowledge-base-import');
    cy.getByCy('csv-file-input').selectFile({
      contents: Cypress.Buffer.from(csv),
      fileName: 'fights.csv',
      mimeType: 'text/csv',
    });
    cy.getByCy('import-confirm-btn').should('not.be.disabled').click();
    cy.contains('fight records').should('be.visible');
    cy.visit('/game/knowledge-base');
  }

  it('imports a CSV without header row and shows the record in the knowledge base', () => {
    setupImportScenario('csv-nohdr', 'NoHdrUser', 'NoHdrAlliance', 'NHD', MAGIK_AND_SERPENT).then(({ ownerData }) => {
      // No header line, ko_count present
      importCsvAs(ownerData.user_id, `Magik,Serpent,15,S1,2\n`);

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 1);
      cy.getByCy('fight-records-table').within(() => {
        cy.get('tbody tr')
          .first()
          .within(() => {
            cy.get('td').eq(1).should('contain.text', 'Magik');
            cy.get('td').eq(2).should('contain.text', 'Serpent');
            cy.get('td').eq(5).should('contain.text', '15');
            cy.getByCy('fight-record-ko').should('have.text', '2');
          });
      });
    });
  });

  it('defaults ko_count to 0 when the column is left empty', () => {
    setupImportScenario('csv-emptyko', 'EmptyKoUser', 'EmptyKoAlliance', 'EKO', MAGIK_AND_SERPENT).then(
      ({ ownerData }) => {
        // Header present, trailing empty ko_count
        importCsvAs(ownerData.user_id, `attacker,defender,node,season,ko_count\nMagik,Serpent,20,S1,\n`);

        cy.getByCy('fight-records-table')
          .find('tbody tr')
          .first()
          .within(() => {
            cy.get('td').eq(5).should('contain.text', '20');
            cy.getByCy('fight-record-ko').should('have.text', '0');
          });
      },
    );
  });

  it('combines multiple imported rows from one CSV in the knowledge base', () => {
    setupImportScenario('csv-combine', 'CombineUser', 'CombineAlliance', 'CMB', [
      ['Magik', 'Mystic'],
      ['Serpent', 'Cosmic'],
      ['Doom', 'Mystic'],
    ]).then(({ ownerData }) => {
      // Mixed: one row with ko_count, one with empty ko_count, no header
      importCsvAs(ownerData.user_id, `Magik,Serpent,15,S1,2\nDoom,Serpent,16,S1,\n`);

      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);
      cy.getByCy('fight-records-table').should('contain.text', 'Magik');
      cy.getByCy('fight-records-table').should('contain.text', 'Doom');

      // Only imported records exist — source filter keeps them
      cy.getByCy('filter-source-trigger').click();
      cy.getByCy('filter-source-imported').click();
      cy.getByCy('fight-records-table').find('tbody tr').should('have.length', 2);

      cy.getByCy('filter-source-trigger').click();
      cy.getByCy('filter-source-non-imported').click();
      cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');
    });
  });

  it('excludes imported records when filtering by player pseudo', () => {
    setupImportScenario('csv-player', 'PlayerUser', 'PlayerAlliance', 'PLY', MAGIK_AND_SERPENT).then(
      ({ ownerData, allianceId, champions }) => {
        cy.apiImportFightRecords(ownerData.access_token, allianceId, [
          {
            champion_id: champions['Magik'].id,
            defender_champion_id: champions['Serpent'].id,
            node_number: 15,
            season_name: 'S1',
            ko_count: 2,
          },
        ]);
        cy.apiLogin(ownerData.user_id, 'knowledge-base');

        // Imported record is visible with no player filter
        cy.getByCy('fight-records-table').should('contain.text', 'Magik');

        // Imported records have no game account → a player filter must exclude them
        cy.getByCy('filter-player').type('Player');
        cy.getByCy('fight-records-table').should('contain.text', 'No fight records found.');
      },
    );
  });
});
