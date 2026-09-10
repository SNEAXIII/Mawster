import { setupRosterUser } from '../../support/e2e';

// Deliberately not alphabetical, and not the order the champions are added in:
// the dropdown follows the in-game class wheel through `sortByClassOrder`.
const ADDED = [
  { name: 'WheelMystic', cls: 'Mystic' },
  { name: 'WheelCosmic', cls: 'Cosmic' },
  { name: 'WheelSkill', cls: 'Skill' },
] as const;
const WHEEL_ORDER = ['Cosmic', 'Skill', 'Mystic'];

describe('Roster – class filter order', () => {
  beforeEach(() => {
    cy.truncateDb();
  });

  it('lists the roster classes in wheel order, not alphabetically', () => {
    setupRosterUser('class-order', 'ClassOrderPlayer').then(({ adminData, userData, accountId }) => {
      ADDED.forEach(({ name, cls }) => {
        cy.apiLoadChampion(adminData.access_token, name, cls).then((champs) => {
          cy.apiAddChampionToRoster(userData.access_token, accountId, champs[0].id, '7r3');
        });
      });

      cy.apiLogin(userData.user_id, 'roster');
      cy.getByCy('roster-filter-class').click();
      cy.get('[role="listbox"]').should('be.visible');

      cy.get('[role="listbox"] [data-cy^="class-chip-"]')
        .should('have.length', WHEEL_ORDER.length)
        .then(($chips) => {
          expect([...$chips].map((el) => el.textContent?.trim())).to.deep.equal(WHEEL_ORDER);
        });
    });
  });
});
