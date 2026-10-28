'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createDefenderTracker,
  createNodeChain,
  keepNodes,
  keptOnReopen,
  scopeOf,
  type Draft,
  type WriteTarget,
} from './quick-edit-logic'

export type SaveState = 'pending' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 1000

interface QuickEditWrites {
  place: (to: WriteTarget, node: number, draft: Draft) => Promise<void>
  remove: (to: WriteTarget, node: number) => Promise<void>
}

/**
 * Drafts and save states per node; a `null` draft is a removed defender. A row's edits are
 * sent 1 s after its last change, and a node's writes run one after the other. Only the
 * latest action on a node sets its final state. Drafts win over the map until `reset`.
 */
export function useQuickEditSaves(writes: QuickEditWrites, target: WriteTarget) {
  const [drafts, setDrafts] = useState<Record<number, Draft | null>>({})
  const [states, setStates] = useState<Record<number, SaveState>>({})
  const waiting = useRef(new Map<number, { timer: ReturnType<typeof setTimeout>; draft: Draft }>())
  const tracker = useRef(createDefenderTracker())
  const chain = useRef(createNodeChain())
  const versions = useRef(new Map<number, number>())
  // One counter across scopes: a fresh `versions` map can never match an older write's number.
  const seq = useRef(0)
  const lastScope = useRef<string | null>(null)
  const writesRef = useRef(writes)
  const targetRef = useRef(target)
  useEffect(() => {
    writesRef.current = writes
    targetRef.current = target
  })

  const bump = (node: number) => {
    const version = ++seq.current
    versions.current.set(node, version)
    return () => versions.current.get(node) === version
  }
  const setState = (node: number, state: SaveState | null) =>
    setStates((prev) => {
      const next = { ...prev }
      if (state) next[node] = state
      else delete next[node]
      return next
    })
  const setDraft = (node: number, draft: Draft | null | undefined) =>
    setDrafts(({ [node]: _, ...rest }) => (draft === undefined ? rest : { ...rest, [node]: draft }))

  const send = useCallback((node: number, draft: Draft) => {
    waiting.current.delete(node)
    // The war, BG and tracker are the ones shown now, not when the queued task runs.
    const to = targetRef.current
    const known = tracker.current
    const latest = bump(node)
    setState(node, 'saving')
    return chain.current.run(node, async () => {
      try {
        await writesRef.current.place(to, node, draft)
        known.placed(node)
        if (latest()) setState(node, 'saved')
      } catch {
        if (latest()) setState(node, 'error')
      }
    })
  }, [])

  const edit = useCallback(
    (node: number, draft: Draft) => {
      clearTimeout(waiting.current.get(node)?.timer)
      bump(node)
      setDraft(node, draft)
      setState(node, 'pending')
      const timer = setTimeout(() => void send(node, draft), DEBOUNCE_MS)
      waiting.current.set(node, { timer, draft })
    },
    [send]
  )

  /** `onMap`: the map shows a defender there, which may be stale after our own writes. */
  const remove = useCallback((node: number, onMap: boolean) => {
    clearTimeout(waiting.current.get(node)?.timer)
    waiting.current.delete(node)
    const to = targetRef.current
    const known = tracker.current
    const latest = bump(node)
    setDraft(node, null)
    setState(node, 'saving')
    return chain.current.run(node, async () => {
      // Read after the earlier write settled: it may have placed or failed.
      if (known.holds(node, onMap)) {
        try {
          await writesRef.current.remove(to, node)
          known.removed(node)
        } catch {
          if (latest()) {
            setDraft(node, undefined)
            setState(node, 'error')
          }
          return
        }
      }
      if (latest()) setState(node, null)
    })
  }, [])

  const flush = useCallback(() => {
    for (const [node, { timer, draft }] of waiting.current) {
      clearTimeout(timer)
      void send(node, draft)
    }
  }, [send])

  // On the same war and BG, a write in flight keeps its row locked, its draft and what it
  // knows of the node. Elsewhere all starts afresh, and older writes no longer set a status.
  const reset = useCallback(() => {
    const scope = scopeOf(targetRef.current)
    const keep = keptOnReopen(lastScope.current, scope, (node) => chain.current.busy(node))
    if (lastScope.current !== scope) {
      tracker.current = createDefenderTracker()
      versions.current = new Map()
    }
    lastScope.current = scope
    setDrafts((prev) => keepNodes(prev, keep))
    setStates((prev) => keepNodes(prev, keep))
    tracker.current.clear(keep)
  }, [])

  // Leaving the page must not drop a row still waiting for its second.
  useEffect(() => flush, [flush])

  return { drafts, states, edit, remove, flush, reset }
}
