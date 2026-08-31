#!/usr/bin/env node
/**
 * Regenerate `src/data/champions.json` from a Mawster champion export.
 *
 * Usage:
 *   node scripts/build-champions.mjs ../api/src/fixtures/champions_2026-08-26.json
 *
 * The input is the array the API ships, each entry carrying at least `name`,
 * `champion_class` and `image_url`; `alias`, `is_ascendable`, `has_prefight`
 * and `is_7_star` are used when present. Ids are slugs of the name — stable
 * across runs, which is what lets a saved board survive a data refresh.
 *
 * Non-playable champions and 7-star exceptions are NOT applied here: they live
 * in `src/data/overrides.ts` so a regeneration never silently drops them.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const input = process.argv[2]
if (!input) {
  console.error('usage: node scripts/build-champions.mjs <champions.json>')
  process.exit(1)
}

function slug(name) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/æ/gi, 'ae')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

const source = JSON.parse(readFileSync(resolve(input), 'utf8'))
const seen = new Set()
const champions = source
  .map((c) => {
    const id = slug(c.name)
    if (seen.has(id)) throw new Error(`duplicate id "${id}" for "${c.name}"`)
    seen.add(id)
    return {
      id,
      name: c.name,
      championClass: c.champion_class,
      imageUrl: c.image_url,
      alias: (c.alias ?? '').trim(),
      isAscendable: Boolean(c.is_ascendable),
      hasPrefight: Boolean(c.has_prefight),
      // The fixture has no 7-star column yet; default to available and let
      // `overrides.ts` carry the exceptions.
      isSevenStar: c.is_7_star === undefined ? true : Boolean(c.is_7_star),
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name))

const out = join(here, '..', 'src', 'data', 'champions.json')
writeFileSync(out, `${JSON.stringify(champions, null, 2)}\n`)
console.log(`${champions.length} champions written to ${out}`)
