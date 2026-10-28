'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { useWar } from '@/app/contexts/war-context'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { useChampionCatalog } from '@/hooks/use-champion-catalog'
import { useStoredValue } from '@/hooks/use-stored-value'
import {
  NODE_SLICES,
  FULL_ASC_RANGE,
  FULL_RANK_RANGE,
  parseRangeWithin,
  sliceNodes,
  draftOf,
  type Range,
} from './quick-edit-logic'
import { useQuickEditActions } from './use-quick-edit-actions'
import QuickEditHeader from './quick-edit-header'
import QuickEditRow from './quick-edit-row'

const ALL_SLICES: Range = [0, NODE_SLICES - 1]
const parseRankRange = parseRangeWithin(FULL_RANK_RANGE)
const parseAscRange = parseRangeWithin(FULL_ASC_RANGE)

interface WarQuickEditProps {
  open: boolean
  onClose: () => void
}

/** Full-screen list of the shown Battlegroup's nodes, to record many enemy defenders fast. */
export default function WarQuickEdit({ open, onClose }: Readonly<WarQuickEditProps>) {
  const { t } = useI18n()
  const q = t.game.war.quickEdit
  const { placements, currentWar, selectedBg } = useWar()
  const { champions } = useChampionCatalog(open, true)
  const [rankRange, setRankRange] = useStoredValue(
    'mawster:war-quick-edit-rank-range',
    parseRankRange,
    FULL_RANK_RANGE
  )
  const [ascRange, setAscRange] = useStoredValue(
    'mawster:war-quick-edit-asc-range',
    parseAscRange,
    FULL_ASC_RANGE
  )
  const [slices, setSlices] = useState<Range>(ALL_SLICES)
  const ascendable = useMemo(
    () => new Set(champions.filter((c) => c.is_ascendable).map((c) => c.id)),
    [champions]
  )
  const championsById = useMemo(() => new Map(champions.map((c) => [c.id, c])), [champions])
  const byNode = useMemo(() => new Map(placements.map((p) => [p.node_number, p])), [placements])
  const nodeCount = currentWar?.node_count ?? 50
  const actions = useQuickEditActions({ byNode, ascendable, rankRange, ascRange })
  const { saves, confirm, setConfirm } = actions
  const { reset, flush } = saves

  useEffect(() => {
    if (!open) return
    reset()
    setSlices(ALL_SLICES)
  }, [open, reset])

  const close = () => {
    flush()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && close()}
    >
      <DialogContent
        className='flex h-dvh max-h-none w-screen max-w-none flex-col gap-4 overflow-hidden sm:rounded-none'
        data-cy='war-quick-edit'
      >
        <DialogHeader>
          <DialogTitle>{q.title.replace('{bg}', String(selectedBg))}</DialogTitle>
        </DialogHeader>
        <QuickEditHeader
          nodeCount={nodeCount}
          rankRange={rankRange}
          onRankRange={setRankRange}
          ascRange={ascRange}
          onAscRange={setAscRange}
          slices={slices}
          onSlices={setSlices}
        />
        <div className='flex-1 overflow-y-auto pr-1'>
          {sliceNodes(nodeCount, slices).map((node) => {
            const placement = byNode.get(node)
            const fromMap = placement ? draftOf(placement) : null
            const value = node in saves.drafts ? saves.drafts[node] : fromMap
            return (
              <QuickEditRow
                key={node}
                node={node}
                value={value}
                champion={value ? championsById.get(value.championId) : undefined}
                ascendable={!!value && ascendable.has(value.championId)}
                locked={!!placement?.is_attacker_locked || saves.states[node] === 'saving'}
                saveState={saves.states[node]}
                rankRange={rankRange}
                ascRange={ascRange}
                onPickChampion={(id) => actions.pick(node, value, id)}
                onEdit={(draft) => saves.edit(node, draft)}
                onRemove={() => actions.remove(node)}
              />
            )
          })}
        </div>
      </DialogContent>
      <ConfirmationDialog
        open={confirm !== null}
        onOpenChange={(isOpen) => !isOpen && setConfirm(null)}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        variant='destructive'
        onConfirm={() => confirm?.apply()}
        dataCy='war-quick-edit-confirm'
      />
    </Dialog>
  )
}
