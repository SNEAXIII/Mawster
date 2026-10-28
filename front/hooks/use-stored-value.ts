'use client'

import { useSyncExternalStore } from 'react'

interface Store<T> {
  read: () => T
  write: (next: T | ((prev: T) => T)) => void
  subscribe: (listener: () => void) => () => void
}

const stores = new Map<string, Store<unknown>>()

function createStore<T>(key: string, parse: (raw: unknown) => T, fallback: T): Store<T> {
  let cached: { value: T } | null = null
  const listeners = new Set<() => void>()
  const read = () => {
    if (cached) return cached.value
    try {
      const raw = window.localStorage.getItem(key)
      cached = { value: raw ? parse(JSON.parse(raw)) : fallback }
    } catch {
      cached = { value: fallback }
    }
    return cached.value
  }
  const write = (next: T | ((prev: T) => T)) => {
    const value = typeof next === 'function' ? (next as (prev: T) => T)(read()) : next
    cached = { value }
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Private browsing: the value still lives for this session.
    }
    listeners.forEach((listener) => listener())
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  return { read, write, subscribe }
}

/**
 * A localStorage value shared by every component reading the same `key`: a write
 * reaches all of them at once. The first caller's `parse` and `fallback` win.
 */
export function useStoredValue<T>(key: string, parse: (raw: unknown) => T, fallback: T) {
  let store = stores.get(key) as Store<T> | undefined
  if (!store) {
    store = createStore(key, parse, fallback)
    stores.set(key, store as Store<unknown>)
  }
  const value = useSyncExternalStore(store.subscribe, store.read, () => fallback)
  return [value, store.write] as const
}
