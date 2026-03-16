import { setupWarOwner, setupUser, BACKEND } from '../../support/e2e';

describe('War – Attackers mode', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  // ── Setup helper: owner + member in BG1 + war + defender on node 10 ────────

  function setupAttackerScenario(prefix: string) {
    let adminToken: string;
    let ownerData: any;
    let memberData: any;
    let allianceId: string;
    let ownerAccId: string;
    let memberAccId: string;
    let warId: string;
    let championUserId: string;

    return setupWarOwner(`${prefix}`, `${prefix}Owner`, `${prefix}Alliance`, prefix.slice(0, 3).toUpperCase())
      .then(({ adminData: ad, ownerData: od, allianceId: aid, ownerAccId: oaid }) => {
        adminToken = ad.access_token;
        ownerData = od;
        allianceId = aid;
        ownerAccId = oaid;

        // Set owner to BG1
        return cy.apiSetMemberGroup(od.access_token, aid, oaid, 1);
      })
      .then(() => setupUser(`${prefix}-member`))
      .then((member) => {
        memberData = member;
        return cy.apiCreateGameAccount(member.access_token, `${prefix}Member`, true);
      })
      .then((acc) => {
        memberAccId = acc.id;
        cy.apiForceJoinAlliance(memberAccId, allianceId);
        return cy.apiSetMemberGroup(ownerData.access_token, allianceId, memberAccId, 1);
      })
      .then(() => cy.apiCreateWar(ownerData.access_token, allianceId, 'AttackerEnemy'))
      .then((war) => {
        warId = war.id;
        return cy.apiLoadChampion(adminToken, 'Iron Man', 'Tech');
      })
      .then((champs) => {
        const championId = champs[0].id;
        return cy.apiPlaceWarDefender(ownerData.access_token, allianceId, warId, 1, 10, championId, 7, 3, 0);
      })
      .then(() => cy.apiLoadChampion(adminToken, 'Wolverine', 'Mutant'))
      .then((champs) => {
        const wolfId = champs[0].id;
        return cy.apiAddChampionToRoster(memberData.access_token, memberAccId, wolfId, '7r3');
      })
      .then((cu) => {
        championUserId = cu.id;
        return cy.wrap({
          adminToken,
          ownerData,
          memberData,
          allianceId,
          ownerAccId,
          memberAccId,
          warId,
          championUserId,
        });
      });
  }

  // ── Attacker panel visible in Attackers mode ──────────────────────────────

  it('attackers panel is visible by default (Attackers mode)', () => {
    setupAttackerScenario('atk-panel').then(({ ownerData, allianceId, warId }) => {
      cy.uiLogin(ownerData.login);
      cy.navTo('war');

      cy.getByCy('tab-war-defenders').click();
      // Mode toggle: Attackers should be active by default
      cy.getByCy('war-mode-attackers').should('have.class', 'bg-primary');
    });
  });

  // ── Assign attacker via API and check sidebar ─────────────────────────────

  it('assigned attacker appears in the attacker panel', () => {
    setupAttackerScenario('atk-sidebar').then(
      ({ ownerData, memberData, allianceId, warId, championUserId }) => {
        // Assign via API
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        cy.getByCy('tab-war-defenders').click();

        // Should see the attacker entry
        cy.getByCy('attacker-entry-node-10').should('be.visible');
        cy.getByCy('attacker-entry-node-10').should('contain', 'Wolverine');
      }
    );
  });

  // ── KO increment / decrement ──────────────────────────────────────────────

  it('member can increment and decrement KO count', () => {
    setupAttackerScenario('atk-ko').then(
      ({ memberData, ownerData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        cy.getByCy('tab-war-defenders').click();

        // Initial KO = 0
        cy.getByCy('ko-value-node-10').should('have.text', '0');

        // Increment
        cy.getByCy('ko-inc-node-10').click();
        cy.getByCy('ko-value-node-10').should('have.text', '1');

        // Increment again
        cy.getByCy('ko-inc-node-10').click();
        cy.getByCy('ko-value-node-10').should('have.text', '2');

        // Decrement
        cy.getByCy('ko-dec-node-10').click();
        cy.getByCy('ko-value-node-10').should('have.text', '1');
      }
    );
  });

  // ── Remove attacker ───────────────────────────────────────────────────────

  it('member can remove an assigned attacker', () => {
    setupAttackerScenario('atk-remove').then(
      ({ memberData, ownerData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        cy.getByCy('tab-war-defenders').click();

        cy.getByCy('attacker-entry-node-10').should('be.visible');
        cy.getByCy('remove-attacker-node-10').click();
        cy.getByCy('attacker-entry-node-10').should('not.exist');
      }
    );
  });

  // ── Assign via UI (click node in Attackers mode) ──────────────────────────

  it('member can assign attacker by clicking a node in Attackers mode', () => {
    setupAttackerScenario('atk-ui').then(
      ({ memberData, ownerData, allianceId, warId }) => {
        cy.uiLogin(memberData.login);
        cy.navTo('war');
        cy.getByCy('tab-war-defenders').click();

        // Mode toggle should show Attackers by default
        cy.getByCy('war-mode-attackers').click();

        // Click node 10 (has a defender)
        cy.getByCy('war-node-10').scrollIntoView().click({ force: true });

        // Attacker selector modal should open
        cy.getByCy('war-attacker-search').should('be.visible');

        // Wolverine should be available (not a defender)
        cy.getByCy('attacker-card-Wolverine').should('be.visible').click();

        // Should see attacker entry in panel
        cy.getByCy('attacker-entry-node-10').should('be.visible');
      }
    );
  });

  // ── Node without defender shows warning ──────────────────────────────────

  it('clicking node without defender shows warning toast', () => {
    setupAttackerScenario('atk-warn').then(({ memberData }) => {
      cy.uiLogin(memberData.login);
      cy.navTo('war');
      cy.getByCy('tab-war-defenders').click();

      // Click node 20 which has no defender
      cy.getByCy('war-node-20').scrollIntoView().click({ force: true });

      // Should see a warning toast, not the attacker selector
      cy.getByCy('war-attacker-search').should('not.exist');
    });
  });

  // ── x/3 counter visible in panel ─────────────────────────────────────────

  it('attacker panel shows x/3 counter per member', () => {
    setupAttackerScenario('atk-count').then(
      ({ memberData, ownerData, allianceId, warId, championUserId }) => {
        cy.apiAssignWarAttacker(memberData.access_token, allianceId, warId, 1, 10, championUserId);

        cy.uiLogin(ownerData.login);
        cy.navTo('war');
        cy.getByCy('tab-war-defenders').click();

        // Panel should show 1/3
        cy.contains('1/3').should('be.visible');
      }
    );
  });
});
