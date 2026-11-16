import expected from '../fixtures/vision/expected.json';

// What each fixture shot shows, from its verified ground truth: file → champion → card.
export interface ShotCard {
  rarity: string;
  signature: number;
  ascension: number;
}
export const SHOTS: Record<string, Record<string, ShotCard>> = expected;

// A shot reads in under 1 s on CPU and the front polls every 1.5 s.
export const VISION_TIMEOUT = 10000;

// The bulk import resolves every predicted name, so each champion a shot shows must exist.
// The class is never checked; ascendable, or the API zeroes the ascension the shot shows.
export function loadShotChampions(adminToken: string, shots: string[], extra: string[] = []) {
  const names = new Set([...shots.flatMap((s) => Object.keys(SHOTS[s])), ...extra]);
  return cy.apiLoadChampions(
    adminToken,
    [...names].map((name) => ({ name, cls: 'Science', is_ascendable: true })),
  );
}

export function uploadShots(...files: string[]): void {
  // The input is visually hidden, so selectFile can only attach a fixture with force.
  cy.get('[data-cy="vision-input"]').selectFile(
    files.map((f) => `cypress/fixtures/vision/${f}`),
    { force: true },
  );
  if (files.length === 1) {
    // Scoped: the how-to dialog may still be closing, with its own cancel button.
    cy.getByCy('vision-single-screen-dialog')
      .should('be.visible')
      .find('[data-cy="confirmation-dialog-cancel"]')
      .click();
  }
}

const rowKey = (name: string, c: ShotCard) => `${name} ${c.rarity} sig ${c.signature} asc ${c.ascension}`;

// Every preview row matches a card of the uploaded shots, order-independent. Clear reads start
// collapsed and out of the DOM, so every score group is opened first.
export function assertPreviewMatchesShots(shots: string[], overrides: Record<string, Partial<ShotCard>> = {}) {
  const want = shots
    .flatMap((s) => Object.entries(SHOTS[s]))
    .map(([name, c]) => rowKey(name, { ...c, ...overrides[name] }))
    .sort((a, b) => a.localeCompare(b));
  cy.get('[data-cy^="preview-group-toggle-"]', { timeout: VISION_TIMEOUT }).each(($toggle) => {
    if ($toggle.attr('data-state') === 'closed') cy.wrap($toggle).click();
  });
  cy.get('[data-cy^="preview-row-"][data-champion]').should(($rows) => {
    const got = [...$rows]
      .map((row) => {
        const $row = Cypress.$(row);
        return rowKey(String($row.attr('data-champion')), {
          rarity: String($row.attr('data-rarity')),
          signature: Number($row.find('[data-cy^="preview-row-signature-input-"]').val()),
          ascension: Number($row.find('[data-cy^="preview-row-ascension-input-"]').val()),
        });
      })
      .sort((a, b) => a.localeCompare(b));
    expect(got).to.deep.equal(want);
  });
}

// Row order is not stable: a row is found by its champion, unique in a shot.
export function rowIndexOf(name: string): Cypress.Chainable<number> {
  return cy
    .get(`[data-cy^="preview-row-"][data-champion="${name}"]`)
    .should('have.length', 1)
    .invoke('attr', 'data-cy')
    .then((dataCy) => Number(String(dataCy).replace('preview-row-', '')));
}

export interface RosterRow {
  champion_name: string;
  rarity: string;
  signature: number;
  ascension: number;
  is_preferred_attacker: boolean;
}

export function getRoster(token: string, accountId: string): Cypress.Chainable<RosterRow[]> {
  return cy.apiRequest(token, 'GET', `/champion-users/by-account/${accountId}`).then((res) => res.body as RosterRow[]);
}
