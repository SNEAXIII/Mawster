/** The six champion classes, in the order the class filter shows them. */
export const CHAMPION_CLASSES = ['Cosmic', 'Tech', 'Mutant', 'Skill', 'Science', 'Mystic'] as const

export type ChampionClass = (typeof CHAMPION_CLASSES)[number]

export interface Champion {
  /** Slug of the name — stable across data regenerations, used as the storage key. */
  id: string
  name: string
  championClass: ChampionClass
  /** Path on the Mawster static server, e.g. `/static/champions/groot.png`. */
  imageUrl: string
  /** Space-separated short names players type when searching ("abo immo"). */
  alias: string
  isAscendable: boolean
  hasPrefight: boolean
  isSevenStar: boolean
}

/** Per-champion tags the user sets; each one is also a filter and a card badge. */
export const ATTRIBUTE_KEYS = ['atk', 'def', 'dual', 'ga', 'bg', 'asc', 'awk'] as const
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]

export interface ChampionAttributes {
  /** Set attributes. Absent key means unset. */
  flags: Partial<Record<AttributeKey, boolean>>
  /** Signature level shown as "x200" next to the awakening badge. */
  sig?: number
}

export interface Tier {
  id: string
  label: string
  /** Row background, any CSS colour — the label text auto-contrasts against it. */
  color: string
  /** Champion ids in this row, in display order. */
  championIds: string[]
}

/** Everything persisted to localStorage and written by the JSON export. */
export interface BoardState {
  version: 1
  tiers: Tier[]
  attributes: Record<string, ChampionAttributes>
  /** Chosen icon variant per attribute — see `lib/icons.tsx`. */
  iconChoices: Partial<Record<AttributeKey, string>>
  /** Star frame drawn behind every portrait; `none` renders the bare artwork. */
  frame: FrameOption
  title: string
}

export const FRAME_OPTIONS = ['7', '6', 'none'] as const
export type FrameOption = (typeof FRAME_OPTIONS)[number]
