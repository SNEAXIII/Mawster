import expected from '../fixtures/vision/expected.json';

// What each fixture shot shows, from its verified ground truth: file → champion → card.
export interface ShotCard {
  rarity: string;
  signature: number;
  ascension: number;
}
export const SHOTS: Record<string, Record<string, ShotCard>> = expected;

const CLASSES: Record<string, string> = {
  'Abomination (Immortal)': 'Science',
  'Absorbing Man': 'Mystic',
  'Ant-Man': 'Science',
  Apocalypse: 'Mutant',
  Archangel: 'Mutant',
  'Arnim Zola': 'Tech',
  'Baron Zemo': 'Skill',
  Bastion: 'Tech',
  'Beta Ray Bill': 'Cosmic',
  'Black Panther (Civil War)': 'Skill',
  Blade: 'Skill',
  'Captain Britain': 'Mutant',
  'Captain Marvel': 'Cosmic',
  "Chee'ilth": 'Skill',
  'Count Nefaria': 'Science',
  Crossbones: 'Skill',
  'Cull Obsidian': 'Cosmic',
  'Dani Moonstar': 'Mutant',
  "Daredevil (Hell's Kitchen)": 'Skill',
  Dazzler: 'Mutant',
  'Deadpool (X-Force)': 'Mutant',
  'Doctor Voodoo': 'Mystic',
  Dust: 'Mutant',
  'Ebony Maw': 'Mystic',
  Electro: 'Science',
  'Elsa Bloodstone': 'Skill',
  Gambit: 'Mutant',
  Gamora: 'Cosmic',
  'Ghost Rider': 'Mystic',
  Guardian: 'Tech',
  'Guillotine (Deathless)': 'Mystic',
  Hawkeye: 'Skill',
  Hulk: 'Science',
  'Human Torch': 'Science',
  'Human Torch (Victorious)': 'Science',
  'Invisible Woman (Victorious)': 'Science',
  'Iron Man': 'Tech',
  Isophyne: 'Mystic',
  'Jabari Panther': 'Skill',
  "Jack O'Lantern": 'Tech',
  'Jean Grey': 'Mutant',
  'Karolina Dean': 'Cosmic',
  Kindred: 'Mystic',
  'King Groot (Deathless)': 'Cosmic',
  Knull: 'Cosmic',
  Korg: 'Skill',
  Kushala: 'Mystic',
  'Lady Deathstrike': 'Tech',
  Lizard: 'Science',
  Longshot: 'Mystic',
  'Maestro (Cosmic)': 'Cosmic',
  Magik: 'Mystic',
  Mangog: 'Mystic',
  Mantis: 'Skill',
  'Mister Sinister': 'Mutant',
  Mojo: 'Mystic',
  Moondragon: 'Skill',
  Mordo: 'Mystic',
  Mysterio: 'Tech',
  Namor: 'Mutant',
  'Negasonic Teenage Warhead': 'Mutant',
  'Nick Fury': 'Skill',
  'Nico Minoru': 'Mystic',
  Nimrod: 'Tech',
  Nova: 'Cosmic',
  Okoye: 'Skill',
  'Omega Sentinel': 'Tech',
  Onslaught: 'Mutant',
  Patriot: 'Skill',
  'Peni Parker': 'Tech',
  Phoenix: 'Cosmic',
  Photon: 'Science',
  'Professor X': 'Mutant',
  Prowler: 'Tech',
  'Punisher 2099': 'Tech',
  Purgatory: 'Mystic',
  Quicksilver: 'Science',
  'Rocket Raccoon': 'Tech',
  Ronan: 'Cosmic',
  Sauron: 'Mutant',
  Scorpion: 'Science',
  Sentinel: 'Tech',
  'Shang-Chi': 'Skill',
  Shocker: 'Tech',
  'Silver Sable': 'Skill',
  'Silver Surfer': 'Cosmic',
  'Sorcerer Supreme': 'Mystic',
  'Spider-Ham': 'Science',
  'Spider-Man (Classic)': 'Science',
  'Spider-Man (Stark Enhanced)': 'Tech',
  'Spider-Man (Stealth Suit)': 'Skill',
  'Spider-Man (Supreme)': 'Mystic',
  'Spider-Woman (Jessica Drew)': 'Science',
  Stryfe: 'Mutant',
  'Thanos (Deathless)': 'Cosmic',
  'The Destroyer': 'Mystic',
  'The Hood': 'Mystic',
  'The Maker': 'Tech',
  'The Overseer': 'Science',
  'The Serpent': 'Cosmic',
  Thing: 'Science',
  'Viv Vision': 'Tech',
  Vox: 'Cosmic',
  Warlock: 'Tech',
  'White Tiger': 'Mystic',
  Wiccan: 'Mystic',
  Wong: 'Mystic',
  'Yelena Belova': 'Skill',
};

// The worker runs on CPU in CI; the front itself gives up polling after 180 s.
export const VISION_TIMEOUT = 180000;

// The bulk import resolves every predicted name, so each champion a shot shows must exist.
// Ascendable, or the API zeroes the ascension the shot shows.
export function loadShotChampions(adminToken: string, shots: string[], extra: string[] = []) {
  const names = new Set([...shots.flatMap((s) => Object.keys(SHOTS[s])), ...extra]);
  return cy.apiLoadChampions(
    adminToken,
    [...names].map((name) => ({ name, cls: CLASSES[name], is_ascendable: true })),
  );
}

export function uploadShots(...files: string[]): void {
  // The input is visually hidden, so selectFile can only attach a fixture with force.
  cy.get('[data-cy="vision-input"]').selectFile(
    files.map((f) => `cypress/fixtures/vision/${f}`),
    { force: true },
  );
  if (files.length === 1) {
    cy.getByCy('vision-single-screen-dialog').should('be.visible');
    cy.getByCy('confirmation-dialog-cancel').click();
  }
}

const rowKey = (name: string, c: ShotCard) => `${name} ${c.rarity} sig ${c.signature} asc ${c.ascension}`;

// Every preview row matches a card of the uploaded shots, order-independent. Clear reads start
// collapsed and out of the DOM, so every score group is opened first.
export function assertPreviewMatchesShots(shots: string[], overrides: Record<string, Partial<ShotCard>> = {}) {
  const want = shots
    .flatMap((s) => Object.entries(SHOTS[s]))
    .map(([name, c]) => rowKey(name, { ...c, ...overrides[name] }))
    .sort();
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
      .sort();
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
