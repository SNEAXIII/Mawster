import type { ComponentType } from 'react'
import PaletteShowcase from './palette'
import ButtonsShowcase from './buttons'
import CardsShowcase from './cards'
import FormsShowcase from './forms'
import TableShowcase from './table'
import OverlaysShowcase from './overlays'
import FeedbackShowcase from './feedback'
import NavigationShowcase from './navigation'
import ChampionShowcase from './champion'
import RosterShowcase from './roster'

export const SHOWCASE_GROUPS = ['Tokens', 'Primitives', 'House', 'Domain'] as const

interface Showcase {
  slug: string
  title: string
  group: (typeof SHOWCASE_GROUPS)[number]
  description: string
  Component: ComponentType
}

/** Adding a showcase = one file in this folder + one entry here. */
export const SHOWCASES: Showcase[] = [
  {
    slug: 'palette',
    title: 'Palette',
    group: 'Tokens',
    description: 'Semantic tokens, class colours, hard-coded colours',
    Component: PaletteShowcase,
  },
  {
    slug: 'buttons',
    title: 'Buttons',
    group: 'Primitives',
    description: 'Button variants × sizes, ActionIconButton',
    Component: ButtonsShowcase,
  },
  {
    slug: 'cards',
    title: 'Cards & badges',
    group: 'Primitives',
    description: 'Card layouts, Badge variants',
    Component: CardsShowcase,
  },
  {
    slug: 'forms',
    title: 'Forms',
    group: 'Primitives',
    description: 'Input, SearchInput, Select, Checkbox, Switch, ToggleGroup',
    Component: FormsShowcase,
  },
  {
    slug: 'table',
    title: 'Table',
    group: 'Primitives',
    description: 'Table with roster rows',
    Component: TableShowcase,
  },
  {
    slug: 'overlays',
    title: 'Overlays',
    group: 'Primitives',
    description: 'Dialog, ConfirmationDialog, Popover, Tooltip, DropdownMenu',
    Component: OverlaysShowcase,
  },
  {
    slug: 'feedback',
    title: 'Feedback',
    group: 'House',
    description: 'Alert, ErrorBanner, Skeleton',
    Component: FeedbackShowcase,
  },
  {
    slug: 'navigation',
    title: 'Navigation',
    group: 'House',
    description: 'TabBar, ToggleButton, CollapsibleSection',
    Component: NavigationShowcase,
  },
  {
    slug: 'champion',
    title: 'Champion',
    group: 'House',
    description: 'ChampionPortrait badges, ClassChip',
    Component: ChampionShowcase,
  },
  {
    slug: 'roster',
    title: 'Roster & war',
    group: 'Domain',
    description: 'RosterChampionCard states, WarStatusBadge',
    Component: RosterShowcase,
  },
]
