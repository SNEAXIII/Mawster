import { setupRosterUser } from '../../support/e2e';
import { assertPreviewMatchesShots, getRoster, loadShotChampions, uploadShots } from '../../support/vision';

// A vision import reads a game screenshot, and the game screen has no notion
// of "preferred attacker" — that flag is a Mawster-only choice the player made
// by hand. So the import must never carry an opinion about it: updating a
// champion's rarity or signature from a screenshot has to leave the flag alone.
//
// shot_0001 shows Kindred at 7r4: owning him at 7r3 makes his row a genuine
// "updated" row — the case where the flag used to be wiped.
describe('Roster – Vision import preserves preferred attacker', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('keeps the preferred-attacker flag on a champion the import updates', () => {
    setupRosterUser('vision-pref', 'PrefVisionPlayer').then(({ adminData, userData, accountId }) => {
      loadShotChampions(adminData.access_token, ['shot_0001.png']).then((champs) => {
        cy.apiAddChampionToRoster(userData.access_token, accountId, champs['Kindred'].id, '7r3', {
          attack_preference: 'preferred',
        });
      });

      cy.apiLogin(userData.user_id, 'roster');

      // Baseline: Kindred is the only preferred attacker.
      cy.getByCy('preferred-attacker-name').should('have.length', 1);

      uploadShots('shot_0001.png');
      assertPreviewMatchesShots(['shot_0001.png']);

      cy.getByCy('import-preview-confirm-button').should('be.enabled').click();
      cy.get('[data-cy="import-report-close-button"]', { timeout: 30000 }).click();

      cy.getByCy('preferred-attacker-name').should('have.length', 1);
      getRoster(userData.access_token, accountId).then((roster) => {
        const kindred = roster.find((r) => r.champion_name === 'Kindred');
        expect(kindred?.rarity).to.eq('7r4');
        expect(kindred?.attack_preference).to.eq('preferred');
      });
    });
  });
});
