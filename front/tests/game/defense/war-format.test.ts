import { describe, expect, it } from 'vitest'
import {
  BIG_THING_MAP_SECTIONS,
  type MapSection,
  mapSectionsForFormat,
  REGULAR_MAP_SECTIONS,
} from '@/app/game/defense/_components/war-format'

const nodeNumbers = (sections: MapSection[]) =>
  sections.flatMap((section) => section.rows.flat()).filter((node) => node !== 0)

describe('mapSectionsForFormat', () => {
  it.each([
    ['regular', REGULAR_MAP_SECTIONS],
    ['big_thing', BIG_THING_MAP_SECTIONS],
  ] as const)('returns the %s map', (format, expected) => {
    expect(mapSectionsForFormat(format)).toBe(expected)
  })
})

describe('map sections', () => {
  it.each([
    { format: 'regular', sections: REGULAR_MAP_SECTIONS, count: 50 },
    { format: 'big_thing', sections: BIG_THING_MAP_SECTIONS, count: 10 },
  ])('$format map lays out every node from 1 to $count, each once', ({ sections, count }) => {
    const nodes = nodeNumbers(sections).toSorted((a, b) => a - b)

    expect(nodes).toEqual(Array.from({ length: count }, (_, i) => i + 1))
  })
})
