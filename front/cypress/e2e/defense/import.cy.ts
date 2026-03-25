import { setupDefenseOwner, BACKEND } from '../../support/e2e';

describe('Defense – Import & BG isolation', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Import round-trip
  // =========================================================================

  it('import round-trip restores the placement correctly', () => {
    setupDefenseOwner('def-op-imp', 'ImportPlyr', 'ImportAll', 'IM').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5')
            .then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)),
        );

        // Export via API
        cy.request({
          method: 'GET',
          url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/export`,
          headers: { Authorization: `Bearer ${ownerData.access_token}` },
        }).then((exportRes) => {
          expect(exportRes.status).to.eq(200);
          const exportData = exportRes.body;

          // Clear via API
          cy.request({
            method: 'DELETE',
            url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/clear`,
            headers: { Authorization: `Bearer ${ownerData.access_token}` },
          });

          // Import via API
          cy.request({
            method: 'POST',
            url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/import`,
            headers: { Authorization: `Bearer ${ownerData.access_token}` },
            body: { placements: exportData },
          }).then((importRes) => {
            expect(importRes.status).to.eq(200);
            expect(importRes.body.success_count).to.eq(1);
            expect(importRes.body.error_count).to.eq(0);
          });

          // Verify in UI
          cy.uiLogin(ownerData.login);
          cy.navTo('defense');
          cy.getByCy('defender-count-ImportPlyr').should('contain', '1/5');
          cy.getByCy('member-section-ImportPlyr').find('[title*="Spider-Man"]').should('exist');
        });
      },
    );
  });

  it('import via UI file upload shows import report dialog', () => {
    setupDefenseOwner('def-op-impui', 'ImpUIPlyr', 'ImpUIAll', 'IU').then(({ adminData, ownerData, ownerAccId }) => {
      cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
        cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3'),
      );

      cy.uiLogin(ownerData.login);
      cy.navTo('defense');

      // Prepare import JSON
      const importData = [{ champion_name: 'Spider-Man', rarity: '7r3', node_number: 1, owner_name: 'ImpUIPlyr' }];

      // Create a file and upload it
      const blob = new Blob([JSON.stringify(importData)], { type: 'application/json' });
      const file = new File([blob], 'defense_import.json', { type: 'application/json' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      cy.get('input[type="file"]').then((input) => {
        const el = input[0] as HTMLInputElement;
        el.files = dataTransfer.files;
        cy.wrap(input).trigger('change', { force: true });
      });

      cy.contains('Import Report').should('be.visible');
    });
  });

  it('import with unknown champion shows error in report', () => {
    setupDefenseOwner('def-op-imperr', 'ImpErrPlyr', 'ImpErrAll', 'IE').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3'),
        );

        // Import via API with an unknown champion
        cy.request({
          method: 'POST',
          url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/import`,
          headers: { Authorization: `Bearer ${ownerData.access_token}` },
          body: {
            placements: [
              {
                champion_name: 'Spider-Man',
                rarity: '7r3',
                node_number: 1,
                owner_name: 'ImpErrPlyr',
              },
              {
                champion_name: 'NonExistentHero',
                rarity: '7r3',
                node_number: 2,
                owner_name: 'ImpErrPlyr',
              },
            ],
          },
        }).then((importRes) => {
          expect(importRes.status).to.eq(200);
          expect(importRes.body.success_count).to.eq(1);
          expect(importRes.body.error_count).to.eq(1);
          expect(importRes.body.errors[0].champion_name).to.eq('NonExistentHero');
          expect(importRes.body.errors[0].reason).to.include('Unknown champion');
        });

        // Verify only Spider-Man was placed
        cy.uiLogin(ownerData.login);
        cy.navTo('defense');
        cy.getByCy('defender-count-ImpErrPlyr').should('contain', '1/5');
      },
    );
  });

  it('import with unknown player shows error in report', () => {
    setupDefenseOwner('def-op-impunk', 'ImpUnkPlyr', 'ImpUnkAll', 'IK').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3'),
        );

        cy.request({
          method: 'POST',
          url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/import`,
          headers: { Authorization: `Bearer ${ownerData.access_token}` },
          body: {
            placements: [
              {
                champion_name: 'Spider-Man',
                rarity: '7r3',
                node_number: 1,
                owner_name: 'GhostPlayer',
              },
            ],
          },
        }).then((importRes) => {
          expect(importRes.status).to.eq(200);
          expect(importRes.body.success_count).to.eq(0);
          expect(importRes.body.error_count).to.eq(1);
          expect(importRes.body.errors[0].reason).to.include('not found');
        });
      },
    );
  });

  it('import clears previous defense before placing new ones', () => {
    setupDefenseOwner('def-op-impclr', 'ImpClrPlyr', 'ImpClrAll', 'IC').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampions(adminData.access_token, [
          { name: 'Spider-Man', cls: 'Cosmic' },
          { name: 'Wolverine', cls: 'Mutant' },
        ]).then((champMap) => {
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Spider-Man'].id, '7r5').then((cu) =>
            cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId),
          );
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champMap['Wolverine'].id, '7r4');
        });

        // Import different placement → previous gets cleared
        cy.request({
          method: 'POST',
          url: `${BACKEND}/alliances/${allianceId}/defense/bg/1/import`,
          headers: { Authorization: `Bearer ${ownerData.access_token}` },
          body: {
            placements: [
              {
                champion_name: 'Wolverine',
                rarity: '7r4',
                node_number: 10,
                owner_name: 'ImpClrPlyr',
              },
            ],
          },
        }).then((importRes) => {
          expect(importRes.status).to.eq(200);
          expect(importRes.body.before).to.have.length(1);
          expect(importRes.body.before[0].champion_name).to.eq('Spider-Man');
          expect(importRes.body.after).to.have.length(1);
          expect(importRes.body.after[0].champion_name).to.eq('Wolverine');
        });

        // Verify in UI
        cy.uiLogin(ownerData.login);
        cy.navTo('defense');
        cy.getByCy('defender-count-ImpClrPlyr').should('contain', '1/5');
        cy.getByCy('war-node-1').should('contain', '+'); // Spider-Man cleared
        cy.getByCy('war-node-10').should('contain', 'ImpClrPlyr'); // Wolverine placed
      },
    );
  });

  // =========================================================================
  // BG switching preserves no cross-contamination
  // =========================================================================

  it('defenders placed in BG1 are not visible in BG2', () => {
    setupDefenseOwner('def-op-bgiso', 'BGIsoPlyr', 'BGIsoAll', 'BI').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
            .then((cu) => cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)),
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        // BG1: Spider-Man on node 1
        cy.getByCy('war-node-1').should('contain', 'BGIsoPlyr');

        // Switch to BG2: node 1 should be empty
        cy.getByCy('defense-bg-2').click();
        cy.getByCy('war-node-1').should('contain', '+');

        // Switch back to BG1: Spider-Man still there
        cy.getByCy('defense-bg-1').click();
        cy.getByCy('war-node-1').should('contain', 'BGIsoPlyr');
      },
    );
  });
});
