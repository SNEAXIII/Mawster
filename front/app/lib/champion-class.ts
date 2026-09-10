export enum ChampionClass {
  COSMIC = 'Cosmic',
  TECH = 'Tech',
  MUTANT = 'Mutant',
  SKILL = 'Skill',
  SCIENCE = 'Science',
  MYSTIC = 'Mystic',
}

/** Declaration order is the in-game class wheel — every class dropdown follows it. */
export const CLASS_ORDER = Object.values(ChampionClass)

/** Tailwind color config per champion class, keyed to the class icon artwork. */
export const CLASS_COLORS: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  Cosmic: {
    bg: 'bg-cyan-400',
    text: 'text-black',
    border: 'border-cyan-300',
    label: 'text-cyan-600 dark:text-cyan-400',
  },
  Tech: {
    bg: 'bg-blue-800',
    text: 'text-white',
    border: 'border-blue-700',
    label: 'text-blue-700 dark:text-blue-400',
  },
  Mutant: {
    bg: 'bg-yellow-400',
    text: 'text-black',
    border: 'border-yellow-300',
    label: 'text-yellow-600 dark:text-yellow-400',
  },
  Skill: {
    bg: 'bg-red-600',
    text: 'text-white',
    border: 'border-red-500',
    label: 'text-red-600 dark:text-red-400',
  },
  Science: {
    bg: 'bg-green-600',
    text: 'text-white',
    border: 'border-green-500',
    label: 'text-green-600 dark:text-green-400',
  },
  Mystic: {
    bg: 'bg-purple-600',
    text: 'text-white',
    border: 'border-purple-500',
    label: 'text-purple-600 dark:text-purple-400',
  },
}

const FALLBACK_COLORS = {
  bg: 'bg-gray-500',
  text: 'text-white',
  border: 'border-gray-400',
  label: 'text-gray-500 dark:text-gray-400',
}

/** Return class colors with a safe fallback */
export function getClassColors(championClass: string) {
  return CLASS_COLORS[championClass] ?? FALLBACK_COLORS
}

/** Class icons sit next to the frames on the static server. */
export function getClassIconUrl(championClass: string): string | null {
  if (!(championClass in CLASS_COLORS)) return null
  return `/static/icons/class-${championClass.toLowerCase()}.png`
}

/** Sort an arbitrary class list into CLASS_ORDER, unknown values last, alphabetically. */
export function sortByClassOrder(classes: readonly string[]): string[] {
  const rank = (c: string) => {
    const i = CLASS_ORDER.indexOf(c as ChampionClass)
    return i === -1 ? CLASS_ORDER.length : i
  }
  return [...classes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}
