import { describe, expect, it, vi } from 'vitest'
import {
  getNextRarity,
  getStarFrameUrl,
  raritySortValue,
  shortenChampionName,
  splitRarity,
} from '@/app/services/roster'
import { api, jsonBody, jsonHeaders } from '@/app/services/utils'
import { getChampionImageUrl } from '@/app/services/champions'
import { getSpriteUrl } from '@/app/services/vision'

describe('rarity helpers', () => {
  it.each([
    ['7r3', { stars: 7, rank: 3 }],
    ['6R5', { stars: 6, rank: 5 }],
    ['7r', null],
    ['', null],
  ])('splitRarity(%j) → %j', (rarity, expected) => {
    expect(splitRarity(rarity)).toEqual(expected)
  })

  it.each([
    ['7r3', 73],
    ['6r5', 65],
    ['junk', 0],
  ])('raritySortValue(%s) → %i', (rarity, expected) => {
    expect(raritySortValue(rarity)).toBe(expected)
  })

  it.each([
    ['7r3', '7r4'],
    ['6r4', '6r5'],
    ['6r5', null],
    ['7r6', null],
    ['junk', null],
  ])('getNextRarity(%s) → %s', (rarity, expected) => {
    expect(getNextRarity(rarity)).toBe(expected)
  })

  it('frames by star level', () => {
    expect(getStarFrameUrl('7r2')).toBe('/static/frame/7_stars.webp')
  })
})

describe('shortenChampionName', () => {
  it.each([
    ['Spider-Woman (Jessica Drew)', 'Spider-Woman'],
    ['Black Widow (Claire Voyant) (Deadly Origin)', 'Black Widow (Claire Voyant)'],
    ['  Storm  ', 'Storm'],
    ['Iron Man', 'Iron Man'],
  ])('%j → %j', (name, expected) => {
    expect(shortenChampionName(name)).toBe(expected)
  })
})

describe('getChampionImageUrl', () => {
  it.each<[string | null, number | undefined, string | null]>([
    [null, 60, null],
    ['/static/champions/cyclops.webp', 40, '/static/champions/cyclops_60x60.webp'],
    ['/static/champions/cyclops.webp', 100, '/static/champions/cyclops_110x110.webp'],
    ['/static/champions/cyclops.webp', undefined, '/static/champions/cyclops_256x256.webp'],
    ['/static/champions/cyclops.webp', 999, '/static/champions/cyclops_256x256.webp'],
    ['cyclops', 60, 'cyclops_60x60.webp'],
  ])('%j at %j → %j', (url, size, expected) => {
    expect(getChampionImageUrl(url, size)).toBe(expected)
  })
})

it('sprite URL goes through the proxy', () => {
  expect(getSpriteUrl('imp', 'job')).toBe('/api/back/vision/imports/imp/jobs/job/crops/sprite')
})

describe('api', () => {
  const stubFetch = (response: Response) => {
    const fetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('prefixes the proxy and parses the JSON body', async () => {
    const fetch = stubFetch(Response.json({ id: 1 }))
    await expect(api('/x', 'oops', jsonBody('POST', { a: 1 }))).resolves.toEqual({ id: 1 })
    expect(fetch).toHaveBeenCalledWith('/api/back/x', {
      headers: jsonHeaders,
      method: 'POST',
      body: '{"a":1}',
    })
  })

  it('returns undefined on an empty body', async () => {
    stubFetch(new Response(null, { status: 204 }))
    await expect(api('/x', 'oops')).resolves.toBeUndefined()
  })

  it.each([
    [{ message: 'taken' }, 'Erreur 409: taken'],
    [{ detail: 'bad' }, 'Erreur 409: bad'],
    ['not json', 'Erreur 409: oops'],
  ])('error body %j → %s with its status', async (body, message) => {
    stubFetch(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 409 }))
    await expect(api('/x', 'oops')).rejects.toMatchObject({ message, status: 409 })
  })

  it('jsonBody leaves the body out without a payload', () => {
    expect(jsonBody('DELETE')).toEqual({ method: 'DELETE', body: undefined })
  })
})
