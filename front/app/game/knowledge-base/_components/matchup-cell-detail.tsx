'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getChampionImageUrl } from '@/app/services/champions'
import type {
  ChampionRef,
  MatchupGridAxisEntry,
  MatchupScoredFight,
  MatchupVerdict,
} from '@/app/services/matchups'
import { SCORE_BADGE_CLASS, scoreClass } from './grid-score'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The attacker grid fixes one attacker and names it above the table, so it passes none here.
  // The defender grid and the evaluation list vary the attacker per row, so they must name it.
  attacker?: ChampionRef | null
  defender: MatchupGridAxisEntry | null
  node: MatchupGridAxisEntry | null
  // Only the fight's combined outcome is read, which both grids' cells and an evaluation row all
  // carry — the dialog does not care which of the three opened it.
  cell: MatchupScoredFight | null
}

function ChampionChip({
  champion,
  required,
}: Readonly<{ champion: ChampionRef; required?: boolean }>) {
  return (
    <span className='inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-2.5 text-xs'>
      {champion.image_url && (
        <img
          src={getChampionImageUrl(champion.image_url, 32) ?? ''}
          alt={champion.champion_name}
          className={`h-6 w-6 rounded-full object-cover ${required ? 'ring-2 ring-amber-400' : ''}`}
        />
      )}
      <span>{champion.champion_name}</span>
    </span>
  )
}

// Visual detail of one "fight": the rated sides (attacker vs the defender, and vs the node) that
// combine into the score, each with a colored verdict pill, synergy portraits (gold ring =
// required) and prefight. Opened from either grid or from the evaluation list; a side the user
// did not target is simply absent, so the dialog renders whichever sides it is given.
export default function MatchupCellDetail({
  open,
  onOpenChange,
  attacker,
  defender,
  node,
  cell,
}: Readonly<Props>) {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase

  const verdictPill = (verdict: MatchupVerdict) => {
    const styles: Record<MatchupVerdict, [string, string]> = {
      good: ['bg-green-700 text-white', kb.verdictGood],
      ok: ['bg-orange-500 text-white', kb.verdictOk],
      discouraged: ['bg-red-600 text-white', kb.verdictDiscouraged],
    }
    const [cls, label] = styles[verdict]
    return (
      <span className={`inline-block w-fit rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
        {label}
      </span>
    )
  }

  const side = (title: string, icon: ReactNode, entry: MatchupGridAxisEntry) => (
    <div className='flex flex-col gap-3 rounded-lg border bg-card p-4'>
      <div className='flex items-center gap-2 text-muted-foreground'>
        {icon}
        <span className='text-sm font-medium'>{title}</span>
      </div>
      {verdictPill(entry.verdict)}
      {entry.synergies.length > 0 && (
        <div className='flex flex-col gap-1.5'>
          <span className='text-xs text-muted-foreground'>{kb.synergies}</span>
          <div className='flex flex-wrap gap-1.5'>
            {entry.synergies.map((s) => (
              <ChampionChip
                key={s.champion_id}
                champion={s}
                required={s.is_required}
              />
            ))}
          </div>
        </div>
      )}
      {entry.prefight && (
        <div className='flex flex-col gap-1.5'>
          <span className='text-xs text-muted-foreground'>{kb.prefight}</span>
          <ChampionChip champion={entry.prefight} />
        </div>
      )}
    </div>
  )

  const defenderIcon = defender?.defender?.image_url ? (
    <img
      src={getChampionImageUrl(defender.defender.image_url, 32) ?? ''}
      alt={defender.defender.champion_name}
      className='h-6 w-6 rounded-full object-cover'
    />
  ) : null

  const nodeIcon = (
    <span className='rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground'>
      #{node?.node_number}
    </span>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        data-cy='matchup-cell-detail'
        className='sm:max-w-2xl'
      >
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <span>
              {[attacker?.champion_name, defender?.defender?.champion_name]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {node && <span className='text-muted-foreground'>· #{node.node_number}</span>}
            {cell &&
              (cell.is_discouraged ? (
                <X className='h-5 w-5 text-destructive' />
              ) : (
                <span className={`${SCORE_BADGE_CLASS} ${scoreClass(cell.score)} ml-1`}>
                  {cell.score}
                </span>
              ))}
          </DialogTitle>
        </DialogHeader>
        <div className='grid gap-3 sm:grid-cols-2'>
          {defender && side(kb.vsDefender, defenderIcon, defender)}
          {node && side(kb.vsNode, nodeIcon, node)}
        </div>
      </DialogContent>
    </Dialog>
  )
}
