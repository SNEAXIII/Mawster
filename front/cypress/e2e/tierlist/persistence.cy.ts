import { BACKEND, setupRosterUser } from '../../support/e2e';

/**
 * How the board is written back: a second after the last gesture, whole, and
 * only when something actually moved. Signed out it never leaves the browser.
 */
describe('Tier list – saving', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  const emptyTiers = () =>
    ['S', 'A', 'B', 'C', 'D'].map((label) => ({
      label,
      color: '#ff7f7f',
      champion_ids: [] as string[],
    }));

  const seedList = (token: string, title: string) =>
    cy
      .request({
        method: 'POST',
        url: `${BACKEND}/tierlists`,
        headers: { Authorization: `Bearer ${token}` },
        body: { title, tiers: emptyTiers(), tags: [] },
      })
      .then((res) => {
        expect(res.status).to.eq(201);
      });

  const rank = (name: string, label: string) => {
    cy.getByCy(`tierlist-champion-${name}`).first().click();
    cy.getByCy(`tierlist-send-to-${label}`).click();
    cy.get('body').type('{esc}');
  };

  it('sends one PUT a second after the change', () => {
    setupRosterUser('tl-save-one', 'SaveOne').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'SaveHero', 'Cosmic');
      seedList(userData.access_token, 'Alpha');
      cy.intercept('PUT', '**/api/back/tierlists/*').as('save');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-pool').should('exist');
      rank('SaveHero', 'S');

      cy.wait('@save').its('response.statusCode').should('eq', 200);
      cy.get('@save.all').should('have.length', 1);
    });
  });

  it('folds gestures made in a row into a single PUT', () => {
    setupRosterUser('tl-save-debounce', 'SaveDebounce').then(({ userData }) => {
      seedList(userData.access_token, 'Alpha');
      cy.intercept('PUT', '**/api/back/tierlists/*').as('save');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-pool').should('exist');
      // Three changes back to back — cheap clicks, well inside the save delay.
      cy.getByCy('tierlist-add-row').click();
      cy.getByCy('tierlist-add-row').click();
      cy.getByCy('tierlist-add-row').click();

      cy.wait('@save');
      cy.get('@save.all').should('have.length', 1);
      // The one payload carries what the three clicks did, not just the last.
      cy.get('@save.all').its('0.request.body.tiers').should('have.length', 8);
    });
  });

  it('sends nothing when nothing moved', () => {
    setupRosterUser('tl-save-idle', 'SaveIdle').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'IdleHero', 'Skill');
      seedList(userData.access_token, 'Alpha');
      cy.intercept('PUT', '**/api/back/tierlists/*').as('save');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-pool').should('exist');
      cy.getByCy('tierlist-search').type('idle');
      cy.getByCy('selector-toggle-ascendable').click();
      cy.getByCy('tierlist-champion-IdleHero').click();
      cy.get('body').type('{esc}');
      cy.getByCy('tierlist-pool').scrollIntoView();

      // Longer than the save delay: if a write were coming, it would be here.
      cy.wait(1500);
      cy.get('@save.all').should('have.length', 0);
    });
  });

  it('goes through Saving… on the way to Saved', () => {
    setupRosterUser('tl-save-state', 'SaveState').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'StateHero', 'Tech');
      seedList(userData.access_token, 'Alpha');
      cy.intercept('PUT', '**/api/back/tierlists/*', (req) => {
        req.continue((res) => {
          res.setDelay(1500);
        });
      }).as('save');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-pool').should('exist');
      cy.getByCy('tierlist-save-state').should('contain', 'Saved');
      rank('StateHero', 'S');

      cy.getByCy('tierlist-save-state').should('contain', 'Saving');
      cy.wait('@save');
      cy.getByCy('tierlist-save-state').should('contain', 'Saved');
    });
  });

  it('shows a failed save without losing the board', () => {
    setupRosterUser('tl-save-error', 'SaveError').then(({ adminData, userData }) => {
      cy.apiLoadChampion(adminData.access_token, 'ErrorHero', 'Mutant');
      seedList(userData.access_token, 'Alpha');
      cy.intercept('PUT', '**/api/back/tierlists/*', {
        statusCode: 500,
        body: { detail: 'Save refused' },
      }).as('save');
      cy.apiLogin(userData.user_id, '/tools');

      cy.getByCy('tierlist-pool').should('exist');
      rank('ErrorHero', 'S');

      cy.wait('@save');
      cy.getByCy('tierlist-save-state').should('contain', 'Save refused');
      cy.getByCy('tierlist-row-S').find('[data-cy="tierlist-champion-ErrorHero"]').should('exist');
    });
  });

  it('keeps a signed-out board off the network', () => {
    setupRosterUser('tl-save-anon', 'SaveAnon').then(({ adminData }) => {
      cy.apiLoadChampion(adminData.access_token, 'AnonHero', 'Science');
      cy.clearAllCookies();
      cy.clearAllSessionStorage();
      cy.clearAllLocalStorage();
      cy.intercept('POST', '**/api/back/tierlists').as('create');
      cy.intercept('PUT', '**/api/back/tierlists/*').as('save');
      cy.visit('/tools');

      cy.getByCy('tierlist-pool').should('exist');
      rank('AnonHero', 'S');

      cy.window().its('localStorage').invoke('getItem', 'mawster-tierlist:board').should('not.be.null');
      cy.wait(1500);
      cy.get('@create.all').should('have.length', 0);
      cy.get('@save.all').should('have.length', 0);
    });
  });
});
