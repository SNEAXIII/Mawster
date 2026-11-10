import { describe, expect, it } from 'vitest'
import {
  MAX_TIER_LISTS,
  createTierList,
  deleteTierList,
  listTierLists,
  loadTierList,
  saveTierList,
} from '@/app/tools/_lib/lists'
import { board, stubLocalStorage } from './fixtures'

const KNOWN = new Set(['hercules'])

describe('tier lists in the browser', () => {
  it('round-trips a created list', () => {
    stubLocalStorage()
    const id = createTierList(board())!

    expect(listTierLists()).toEqual([{ id, title: 'My board', ranked_champion_count: 1 }])
    expect(loadTierList(id, KNOWN)).toEqual(board({ id }))
  })

  it('refuses a list past the cap', () => {
    stubLocalStorage()
    for (let index = 0; index < MAX_TIER_LISTS; index += 1) createTierList(board())

    expect(createTierList(board())).toBeNull()
    expect(listTierLists()).toHaveLength(MAX_TIER_LISTS)
  })

  it('saves over the list with the same id and deletes by id', () => {
    stubLocalStorage()
    const kept = createTierList(board({ title: 'Kept' }))!
    const edited = createTierList(board())!

    saveTierList({ ...board({ title: 'Renamed' }), id: edited })
    deleteTierList(kept)

    expect(listTierLists().map((list) => [list.id, list.title])).toEqual([[edited, 'Renamed']])
  })

  it('adopts the single board kept before lists, once', () => {
    const store = stubLocalStorage()
    store.set('mawster-tierlist:board', JSON.stringify(board({ title: 'Legacy' })))

    expect(listTierLists().map((list) => list.title)).toEqual(['Legacy'])
    expect(store.has('mawster-tierlist:board')).toBe(false)
    expect(listTierLists()).toHaveLength(1)
  })

  it.each([
    ['corrupted JSON', '{not json'],
    ['a value that is not a list', '42'],
  ])('reads as empty from %s', (_, value) => {
    stubLocalStorage().set('mawster-tierlist:lists', value)

    expect(listTierLists()).toEqual([])
  })

  it('behaves as empty when storage is blocked', () => {
    stubLocalStorage({ throwing: true })

    expect(() => createTierList(board())).not.toThrow()
    expect(listTierLists()).toEqual([])
  })
})
