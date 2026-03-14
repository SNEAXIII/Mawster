import { setupUser, setupDefenseOwner, BACKEND } from '../../support/e2e';

describe('Defense – Operations (remove, clear, export, import)', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // =========================================================================
  // Remove defender via side panel
  // =========================================================================

  it('removes a defender from side panel and counter decrements', () => {
    setupDefenseOwner('def-op-rm', 'RmPlyr', 'RmAll', 'RM').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', {
              signature: 200,
            })
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
        );
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r4', {
              signature: 100,
            })
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, ownerAccId)
            )
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defender-count-RmPlyr').should('contain', '2/5');

        // Click remove on the side panel (force click because button is hidden until hover)
        cy.getByCy('member-section-RmPlyr').find('button').first().click({ force: true });

        cy.getByCy('defender-count-RmPlyr').should('contain', '1/5');
        cy.contains('Defender removed').should('be.visible');
      }
    );
  });

  it('removes a defender from the war map red X button', () => {
    setupDefenseOwner('def-op-rmmap', 'RmMapPlyr', 'RmMapAll', 'RX').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', {
              signature: 200,
            })
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 5, cu.id, ownerAccId)
            )
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defender-count-RmMapPlyr').should('contain', '1/5');

        // Remove via the war map X button (force because hidden until hover)
        cy.getByCy('war-node-5').find('button').click({ force: true });

        cy.getByCy('defender-count-RmMapPlyr').should('contain', '0/5');
        cy.getByCy('war-node-5').should('contain', '+');
        cy.contains('Defender removed').should('be.visible');
      }
    );
  });

  it('after removing a defender it reappears in the champion selector', () => {
    setupDefenseOwner('def-op-rmreapp', 'RmReappPlyr', 'RmReappAll', 'RR').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        // Place via UI
        cy.getByCy('war-node-1').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').click();
        cy.getByCy('defender-count-RmReappPlyr').should('contain', '1/5');

        // Spider-Man should NOT appear in selector for another node
        cy.getByCy('war-node-2').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('not.exist');
        cy.get('body').type('{esc}');

        // Remove Spider-Man via side panel
        cy.getByCy('member-section-RmReappPlyr').find('button').first().click({ force: true });
        cy.getByCy('defender-count-RmReappPlyr').should('contain', '0/5');

        // Spider-Man should reappear in selector
        cy.getByCy('war-node-2').scrollIntoView().click({ force: true });
        cy.getByCy('champion-card-Spider-Man').should('be.visible');
      }
    );
  });

  // =========================================================================
  // Clear All
  // =========================================================================

  it('Clear All resets all defender counts to zero', () => {
    setupDefenseOwner('def-op-clr', 'ClearPlyr', 'ClearAll', 'CA').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
        );
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r4')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 2, cu.id, ownerAccId)
            )
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defender-count-ClearPlyr').should('contain', '2/5');

        cy.getByCy('defense-clear-all').click();
        cy.contains('button', 'Confirm').click();

        cy.getByCy('defender-count-ClearPlyr').should('contain', '0/5');
        cy.contains('Defense cleared').should('be.visible');
      }
    );
  });

  it('Clear All empties all nodes on the war map', () => {
    setupDefenseOwner('def-op-clrmap', 'ClrMapPlyr', 'ClrMapAll', 'CM').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 10, cu.id, ownerAccId)
            )
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('war-node-10').should('contain', 'ClrMapPlyr');

        cy.getByCy('defense-clear-all').click();
        cy.contains('button', 'Confirm').click();

        cy.getByCy('war-node-10').should('contain', '+');
      }
    );
  });

  it("Clear All shows 'No defenders placed.' in side panel", () => {
    setupDefenseOwner('def-op-clrempty', 'ClrEmptyPlyr', 'ClrEmptyAll', 'CE').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defense-clear-all').click();
        cy.contains('button', 'Confirm').click();

        cy.contains('No defenders placed.').scrollIntoView().should('be.visible');
      }
    );
  });

  it('Clear All confirmation dialog can be cancelled', () => {
    setupDefenseOwner('def-op-clrcancel', 'ClrCancelPlyr', 'ClrCancelAll', 'CC').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defender-count-ClrCancelPlyr').should('contain', '1/5');

        cy.getByCy('defense-clear-all').click();
        // Dismiss without confirming (press Escape)
        cy.get('body').type('{esc}');

        // Defenders remain intact
        cy.getByCy('defender-count-ClrCancelPlyr').should('contain', '1/5');
      }
    );
  });

  // =========================================================================
  // Export
  // =========================================================================

  it('export returns JSON with champion_name, node_number and owner_name', () => {
    setupDefenseOwner('def-op-exp', 'ExportPlyr', 'ExportAll', 'EP').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5', {
              signature: 200,
            })
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
        );

        cy.intercept('GET', `**/alliances/${allianceId}/defense/bg/1/export`).as('exportReq');

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defense-export').click();
        cy.wait('@exportReq').then((interception) => {
          expect(interception.response?.statusCode).to.eq(200);
          const body = interception.response?.body as Array<Record<string, unknown>>;
          expect(body).to.be.an('array').with.length(1);
          expect(body[0]).to.have.property('champion_name', 'Spider-Man');
          expect(body[0]).to.have.property('node_number', 1);
          expect(body[0]).to.have.property('owner_name', 'ExportPlyr');
          expect(body[0]).to.have.property('rarity', '7r5');
        });
      }
    );
  });

  it('export shows warning toast when no defenders to export', () => {
    setupUser('def-op-exp-empty-tok').then(({ login, access_token }) => {
      cy.apiCreateGameAccount(access_token, 'ExpEmptyPlyr', true).then((acc) => {
        cy.apiCreateAlliance(access_token, 'ExpEmptyAll', 'EE', acc.id);
      });

      cy.uiLogin(login);
      cy.navTo('defense');

      cy.getByCy('defense-export').click();
      cy.contains('No defenders to export').should('be.visible');
    });
  });

  it('export with multiple placements returns all champions', () => {
    setupDefenseOwner('def-op-expmulti', 'ExpMultiPlyr', 'ExpMultiAll', 'EM').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
        );
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r4')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 10, cu.id, ownerAccId)
            )
        );

        cy.intercept('GET', `**/alliances/${allianceId}/defense/bg/1/export`).as('exportMulti');

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        cy.getByCy('defense-export').click();
        cy.wait('@exportMulti').then((interception) => {
          const body = interception.response?.body as Array<Record<string, unknown>>;
          expect(body).to.have.length(2);
          const names = body.map((b) => b.champion_name);
          expect(names).to.include('Spider-Man');
          expect(names).to.include('Wolverine');
          const nodes = body.map((b) => b.node_number);
          expect(nodes).to.include(1);
          expect(nodes).to.include(10);
        });
      }
    );
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
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
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
      }
    );
  });

  it('import via UI file upload shows import report dialog', () => {
    setupDefenseOwner('def-op-impui', 'ImpUIPlyr', 'ImpUIAll', 'IU').then(
      ({ adminData, ownerData, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
        );

        cy.uiLogin(ownerData.login);
        cy.navTo('defense');

        // Prepare import JSON
        const importData = [
          { champion_name: 'Spider-Man', rarity: '7r3', node_number: 1, owner_name: 'ImpUIPlyr' },
        ];

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
      }
    );
  });

  it('import with unknown champion shows error in report', () => {
    setupDefenseOwner('def-op-imperr', 'ImpErrPlyr', 'ImpErrAll', 'IE').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
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
      }
    );
  });

  it('import with unknown player shows error in report', () => {
    setupDefenseOwner('def-op-impunk', 'ImpUnkPlyr', 'ImpUnkAll', 'IK').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r3')
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
      }
    );
  });

  it('import clears previous defense before placing new ones', () => {
    setupDefenseOwner('def-op-impclr', 'ImpClrPlyr', 'ImpClrAll', 'IC').then(
      ({ adminData, ownerData, allianceId, ownerAccId }) => {
        cy.apiLoadChampion(adminData.access_token, 'Spider-Man', 'Cosmic').then((champs) =>
          cy
            .apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r5')
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
        );
        cy.apiLoadChampion(adminData.access_token, 'Wolverine', 'Mutant').then((champs) =>
          cy.apiAddChampionToRoster(ownerData.access_token, ownerAccId, champs[0].id, '7r4')
        );

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
      }
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
            .then((cu) =>
              cy.apiPlaceDefender(ownerData.access_token, allianceId, 1, 1, cu.id, ownerAccId)
            )
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
      }
    );
  });
});
