import type { ComponentType, SVGProps } from 'react'
import {
  BoltIcon,
  ChevronDoubleUpIcon,
  ExclamationTriangleIcon,
  FireIcon,
  FlagIcon,
  MapIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  Squares2X2Icon,
  StarIcon,
  TrophyIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/solid'
import {
  CrossedSwordsIcon,
  FlameIcon,
  GemIcon,
  MedalIcon,
  ShieldIcon,
  SwordIcon,
  SwordShieldIcon,
  VersusIcon,
} from '@/components/custom-icons'
import { ATTRIBUTE_KEYS, type AttributeKey } from './types'

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

export interface IconVariant {
  id: string
  /** Shown under the icon in the mockup picker. */
  label: string
  Icon: IconComponent
}

export interface AttributeDefinition {
  key: AttributeKey
  /** Short code printed on the badge tooltip and used by the JSON export. */
  code: string
  /** Tailwind classes for the badge chip — background, ring and icon colour. */
  chip: string
  /** Accent used by the filter toggle when active. */
  accent: string
  /** Icons offered in the mockup picker; the first one is the default. */
  variants: IconVariant[]
  /** Only `awk` carries a numeric value (the signature level). */
  hasValue?: boolean
}

/**
 * The seven per-champion attributes. Each one is a card badge, a filter toggle
 * and an entry in the icon mockup — driving all three from this single list is
 * what keeps them from drifting apart.
 */
export const ATTRIBUTES: Record<AttributeKey, AttributeDefinition> = {
  atk: {
    key: 'atk',
    code: 'ATK',
    chip: 'bg-rose-500/90 text-white ring-rose-300/60',
    accent: 'data-[on=true]:bg-rose-500 data-[on=true]:text-white data-[on=true]:border-rose-400',
    variants: [
      { id: 'sword', label: 'Sword', Icon: SwordIcon },
      { id: 'crossed', label: 'Crossed swords', Icon: CrossedSwordsIcon },
      { id: 'bolt', label: 'Bolt (Heroicons)', Icon: BoltIcon },
      { id: 'trending', label: 'Chevrons (Heroicons)', Icon: ChevronDoubleUpIcon },
    ],
  },
  def: {
    key: 'def',
    code: 'DEF',
    chip: 'bg-sky-500/90 text-white ring-sky-300/60',
    accent: 'data-[on=true]:bg-sky-500 data-[on=true]:text-white data-[on=true]:border-sky-400',
    variants: [
      { id: 'shield-check', label: 'Shield check (Heroicons)', Icon: ShieldCheckIcon },
      { id: 'shield', label: 'Shield', Icon: ShieldIcon },
      { id: 'shield-alert', label: 'Shield alert (Heroicons)', Icon: ShieldExclamationIcon },
    ],
  },
  dual: {
    key: 'dual',
    code: 'DUAL',
    chip: 'bg-violet-500/90 text-white ring-violet-300/60',
    accent:
      'data-[on=true]:bg-violet-500 data-[on=true]:text-white data-[on=true]:border-violet-400',
    variants: [
      { id: 'sword-shield', label: 'Sword + shield', Icon: SwordShieldIcon },
      { id: 'crossed', label: 'Crossed swords', Icon: CrossedSwordsIcon },
      { id: 'swap', label: 'Arrows (Heroicons)', Icon: ArrowsRightLeftIcon },
    ],
  },
  ga: {
    key: 'ga',
    code: 'THREAT',
    chip: 'bg-amber-500/90 text-black ring-amber-300/60',
    accent: 'data-[on=true]:bg-amber-500 data-[on=true]:text-black data-[on=true]:border-amber-400',
    variants: [
      { id: 'fire', label: 'Fire (Heroicons)', Icon: FireIcon },
      { id: 'flame', label: 'Flame', Icon: FlameIcon },
      { id: 'warning', label: 'Warning (Heroicons)', Icon: ExclamationTriangleIcon },
    ],
  },
  bg: {
    key: 'bg',
    code: 'BG',
    chip: 'bg-emerald-500/90 text-black ring-emerald-300/60',
    accent:
      'data-[on=true]:bg-emerald-500 data-[on=true]:text-black data-[on=true]:border-emerald-400',
    variants: [
      { id: 'trophy', label: 'Trophy (Heroicons)', Icon: TrophyIcon },
      { id: 'versus', label: 'Versus', Icon: VersusIcon },
      { id: 'flag', label: 'Flag (Heroicons)', Icon: FlagIcon },
      { id: 'map', label: 'Map (Heroicons)', Icon: MapIcon },
      { id: 'grid', label: 'Grid (Heroicons)', Icon: Squares2X2Icon },
    ],
  },
  asc: {
    key: 'asc',
    code: 'ASC',
    chip: 'bg-yellow-400 text-black ring-yellow-200/70',
    accent:
      'data-[on=true]:bg-yellow-400 data-[on=true]:text-black data-[on=true]:border-yellow-300',
    variants: [
      { id: 'medal', label: 'Medal', Icon: MedalIcon },
      { id: 'trophy', label: 'Trophy (Heroicons)', Icon: TrophyIcon },
      { id: 'star', label: 'Star (Heroicons)', Icon: StarIcon },
      { id: 'chevrons', label: 'Chevrons (Heroicons)', Icon: ChevronDoubleUpIcon },
    ],
  },
  awk: {
    key: 'awk',
    code: 'AWK',
    chip: 'bg-cyan-400 text-black ring-cyan-200/70',
    accent: 'data-[on=true]:bg-cyan-400 data-[on=true]:text-black data-[on=true]:border-cyan-300',
    hasValue: true,
    variants: [
      { id: 'gem', label: 'Gem', Icon: GemIcon },
      { id: 'sparkles', label: 'Sparkles (Heroicons)', Icon: SparklesIcon },
      { id: 'star', label: 'Star (Heroicons)', Icon: StarIcon },
    ],
  },
}

export const ATTRIBUTE_LIST = ATTRIBUTE_KEYS.map((k) => ATTRIBUTES[k])

/** Resolve the icon component for an attribute, honouring the user's pick. */
export function attributeIcon(key: AttributeKey, chosenId?: string): IconComponent {
  const def = ATTRIBUTES[key]
  const chosen = chosenId ? def.variants.find((v) => v.id === chosenId) : undefined
  return chosen?.Icon ?? def.variants[0].Icon
}
