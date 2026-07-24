import { setupRosterUser } from '../../support/e2e';

// A vision import reads a game screenshot, and the game screen has no notion
// of "preferred attacker" — that flag is a Mawster-only choice the player made
// by hand. So the import must never carry an opinion about it: updating a
// champion's rarity or signature from a screenshot has to leave the flag alone.
//
// Fixture: the fake vision worker (fake-worker/main.py) always returns Hulk at
// 7r3 / signature 200 / ascension 1, and Iron Man at 6r5. Owning Hulk at 7r2
// makes his row a genuine "updated" row — it IS sent to the bulk endpoint —
// which is exactly the case where the flag used to be wiped.
describe('Roster – Vision import preserves preferred attacker', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('keeps the preferred-attacker flag on a champion the import updates', () => {
    setupRosterUser('vision-pref', 'PrefVisionPlayer').then(({ adminData, userData, accountId }) => {
      // Iron Man must exist too: the bulk import resolves every predicted name,
      // and an unknown champion fails the whole request.
      cy.apiLoadChampion(adminData.access_token, 'Iron Man', 'Tech');
      cy.apiLoadChampion(adminData.access_token, 'Hulk', 'Science').then((champs) => {
        const hulkId = (champs as { id: string }[])[0].id;
        cy.apiAddChampionToRoster(userData.access_token, accountId, hulkId, '7r2', {
          is_preferred_attacker: true,
        });
      });

      cy.apiLogin(userData.user_id);
      cy.navTo('roster');

      // Baseline: Hulk is the only preferred attacker.
      cy.getByCy('preferred-attacker-name').should('have.length', 1);

      cy.get('[data-cy="vision-input"]').selectFile('cypress/fixtures/vision/sample-roster.png', {
        force: true,
      });

      cy.get('[data-cy="import-preview-confirm-button"]', { timeout: 30000 }).should('be.enabled').click();
      cy.get('[data-cy="import-report-close-button"]', { timeout: 30000 }).click();

      // The import upgraded Hulk 7r2 → 7r3 and must have left the flag intact.
      cy.getByCy('preferred-attacker-name').should('have.length', 1);
    });
  });
});
