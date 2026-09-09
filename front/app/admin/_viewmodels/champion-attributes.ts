'use client'

import { useI18n } from '@/app/i18n'

export type ChampionAttribute =
  | 'is_7_stars_available'
  | 'is_ascendable'
  | 'has_prefight'
  | 'is_saga_attacker'
  | 'is_saga_defender'

// The game's own glyphs rather than a vector icon set, as in tools/_lib/tags.ts.
const ICON_DIR = '/static/icons'
const FRAME_DIR = '/static/frame'

export interface ChampionAttributeMeta {
  key: ChampionAttribute
  /** data-cy suffix, and the label key under t.champions.attributes. */
  name: string
  icon: string
  /** Saga roles belong to a season, so these are dead without one selected. */
  requiresSeason: boolean
}

/** The single list every attribute UI reads: pills, filter popover and chips. */
export const CHAMPION_ATTRIBUTES: ChampionAttributeMeta[] = [
  {
    key: 'is_7_stars_available',
    name: 'sevenStars',
    icon: `${FRAME_DIR}/7_stars.png`,
    requiresSeason: false,
  },
  {
    key: 'is_ascendable',
    name: 'ascendable',
    icon: `${FRAME_DIR}/ascended_1.png`,
    requiresSeason: false,
  },
  {
    key: 'has_prefight',
    name: 'prefight',
    icon: `${ICON_DIR}/prefight.png`,
    requiresSeason: false,
  },
  {
    key: 'is_saga_attacker',
    name: 'sagaAttacker',
    icon: `${ICON_DIR}/atk-sword.png`,
    requiresSeason: true,
  },
  {
    key: 'is_saga_defender',
    name: 'sagaDefender',
    icon: `${ICON_DIR}/def-shield.png`,
    requiresSeason: true,
  },
]

export const CHAMPION_ATTRIBUTE_KEYS: ChampionAttribute[] = CHAMPION_ATTRIBUTES.map((a) => a.key)

/** `sagaAttacker` → `saga-attacker`, so the data-cy suffix follows the label key. */
export function attributeCy(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

export function requiresSeason(key: ChampionAttribute): boolean {
  return CHAMPION_ATTRIBUTES.find((a) => a.key === key)?.requiresSeason ?? false
}

/** One definition of the attribute labels, shared by the three views that show them. */
export function useChampionAttributeLabels(): Record<ChampionAttribute, string> {
  const { t } = useI18n()
  const labels = t.champions.attributes
  return {
    is_7_stars_available: labels.sevenStars,
    is_ascendable: labels.ascendable,
    has_prefight: labels.prefight,
    is_saga_attacker: labels.sagaAttacker,
    is_saga_defender: labels.sagaDefender,
  }
}
