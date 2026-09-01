import { setupAdmin } from '../../support/e2e';

type Flag = 'prefight' | 'ascendable';

const flagToggle = (flag: Flag, champion: string) => cy.getByCy(`toggle-${flag}-${champion}`);

const expectFlag = (flag: Flag, champion: string, value: 'Yes' | 'No') =>
  flagToggle(flag, champion).should('contain.text', value);

/** Full page reload, then land back on the champions tab. */
function reloadChampionsTab() {
  cy.reload();
  cy.getByCy('tab-champions').click();
}

describe('Admin — champion flag toggles', () => {
  let adminToken: string;

  beforeEach(() => {
    cy.truncateDb();
    setupAdmin('champ-flags-admin').then(({ access_token, user_id }) => {
      adminToken = access_token;
      cy.apiLogin(user_id);
    });
  });

  /** Load one champion as admin, then open the champions tab. */
  function openChampionsTabWith(name: string, cls: string, options?: { is_ascendable?: boolean }) {
    cy.apiLoadChampion(adminToken, name, cls, options);
    cy.goToAdminChampionsTab();
  }

  it('toggle prefight off→on shows Yes, persists on reload', () => {
    openChampionsTabWith('Iron Man', 'Tech');

    expectFlag('prefight', 'Iron Man', 'No');
    flagToggle('prefight', 'Iron Man').click();
    expectFlag('prefight', 'Iron Man', 'Yes');

    reloadChampionsTab();
    expectFlag('prefight', 'Iron Man', 'Yes');
  });

  it('toggle prefight on→off shows No', () => {
    openChampionsTabWith('Iron Man', 'Tech');

    flagToggle('prefight', 'Iron Man').click();
    expectFlag('prefight', 'Iron Man', 'Yes');
    flagToggle('prefight', 'Iron Man').click();
    expectFlag('prefight', 'Iron Man', 'No');
  });

  it('toggle ascendable off→on shows Yes, persists on reload', () => {
    openChampionsTabWith('Wolverine', 'Mutant');

    expectFlag('ascendable', 'Wolverine', 'No');
    flagToggle('ascendable', 'Wolverine').click();
    expectFlag('ascendable', 'Wolverine', 'Yes');

    reloadChampionsTab();
    expectFlag('ascendable', 'Wolverine', 'Yes');
  });

  it('toggle ascendable on→off shows No', () => {
    openChampionsTabWith('Wolverine', 'Mutant', { is_ascendable: true });

    expectFlag('ascendable', 'Wolverine', 'Yes');
    flagToggle('ascendable', 'Wolverine').click();
    expectFlag('ascendable', 'Wolverine', 'No');
  });

  // Saga attacker/defender toggles are now scoped to a selected season
  // (see admin/saga-per-season.cy.ts).
});
