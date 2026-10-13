import type { RosterEntry } from '@/app/services/roster'

// Static assets, no auth needed — served through the /static rewrite.
export const CHAMPIONS = [
  { name: 'Thanos', imageUrl: '/static/champions/thanos.webp', championClass: 'Cosmic' },
  {
    name: 'Absorbing Man',
    imageUrl: '/static/champions/absorbing_man.webp',
    championClass: 'Mystic',
  },
  {
    name: 'Black Panther',
    imageUrl: '/static/champions/black_panther.webp',
    championClass: 'Skill',
  },
  { name: 'Sentinel', imageUrl: '/static/champions/sentinel.webp', championClass: 'Tech' },
  { name: 'Lumatrix', imageUrl: '/static/champions/lumatrix.webp', championClass: 'Skill' },
  { name: 'Groot', imageUrl: '/static/champions/groot.webp', championClass: 'Cosmic' },
  { name: 'Hercules', imageUrl: '/static/champions/hercules.webp', championClass: 'Cosmic' },
  { name: 'Onslaught', imageUrl: '/static/champions/onslaught.webp', championClass: 'Mutant' },
] as const

const ROSTER_SHAPES = [
  { rarity: '7r5', signature: 200, is_preferred_attacker: true, ascension: 2 },
  { rarity: '7r4', signature: 60, is_preferred_attacker: false, ascension: 1 },
  { rarity: '7r3', signature: 0, is_preferred_attacker: false, ascension: 0 },
  { rarity: '6r5', signature: 200, is_preferred_attacker: true, ascension: 0 },
] as const

export const ROSTER_ENTRIES: RosterEntry[] = CHAMPIONS.slice(0, 4).map((champion, i) => ({
  id: `mock-${i}`,
  game_account_id: 'mock-account',
  champion_id: `mock-champion-${i}`,
  champion_name: champion.name,
  champion_class: champion.championClass,
  alias: null,
  image_url: champion.imageUrl,
  is_ascendable: true,
  has_prefight: false,
  is_saga_attacker: i === 0,
  is_saga_defender: false,
  ...ROSTER_SHAPES[i],
}))
