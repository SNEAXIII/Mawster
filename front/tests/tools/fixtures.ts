import { vi } from 'vitest'
import {
  NO_TAGS,
  type BoardState,
  type CatalogChampion,
  type ChampionTags,
} from '@/app/tools/_lib/types'

export function champion(overrides: Partial<CatalogChampion> = {}): CatalogChampion {
  return {
    id: 'hercules',
    name: 'Hercules',
    champion_class: 'Cosmic',
    image_url: null,
    alias: null,
    is_7_stars_available: true,
    is_ascendable: false,
    has_prefight: false,
    is_saga_attacker: false,
    is_saga_defender: false,
    ...overrides,
  }
}

export function tags(overrides: Partial<ChampionTags> = {}): ChampionTags {
  return { ...NO_TAGS, ...overrides }
}

export function board(overrides: Partial<BoardState> = {}): BoardState {
  return {
    id: null,
    title: 'My board',
    tiers: [{ id: 'tier-s', label: 'S', color: '#ff7f7f', championIds: ['hercules'] }],
    tags: {},
    ...overrides,
  }
}

/** Replaces localStorage with an in-memory map, or with one that throws on every call. */
export function stubLocalStorage({ throwing = false } = {}): Map<string, string> {
  const store = new Map<string, string>()
  const guard = <T>(fn: () => T) => {
    if (throwing) throw new DOMException('blocked', 'SecurityError')
    return fn()
  }
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => guard(() => store.get(key) ?? null),
    setItem: (key: string, value: string) => guard(() => store.set(key, value)),
    removeItem: (key: string) => guard(() => store.delete(key)),
  })
  return store
}
