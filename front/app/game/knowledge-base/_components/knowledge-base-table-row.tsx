'use client'
import { AlertTriangle, Users } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import type { FightRecord } from '@/app/services/fight-records'
import { cn } from '@/app/lib/utils'
import { ChampionCell, ChampionIconList, NoteCell } from './knowledge-base-cells'
import { COMPACT_COL } from './knowledge-base-columns'

type KnowledgeBaseTableRowProps = Readonly<{
  record: FightRecord
  /** Keep in sync with `buildKnowledgeBaseColumns` — same columns, same order. */
  exporting: boolean
}>

/** One fight record. Cell order must match the header built from the columns. */
export default function KnowledgeBaseTableRow({
  record: r,
  exporting,
}: KnowledgeBaseTableRowProps) {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase

  return (
    <tr className='border-t border-border hover:bg-muted/30 transition-colors'>
      <td
        className={cn(COMPACT_COL, 'py-2 whitespace-nowrap')}
        data-cy='fight-record-player'
      >
        <div className='flex items-center justify-center gap-1'>
          {r.game_account_pseudo}
          {r.is_planning_error && (
            <span
              title={kb.planningErrorBadge}
              data-cy='fight-record-planning-error'
            >
              <AlertTriangle className='h-3.5 w-3.5 text-amber-500 shrink-0' />
            </span>
          )}
          {r.assisted && (
            <span title={kb.assistedBadge}>
              <Users className='h-3.5 w-3.5 text-blue-400 shrink-0' />
            </span>
          )}
        </div>
      </td>
      <ChampionCell
        name={r.champion_name}
        imageUrl={r.image_url}
        stars={r.stars}
        rank={r.rank}
        ascension={r.ascension}
        isSaga={r.is_saga_attacker}
        sagaMode='attacker'
        dataCy='fight-record-attacker'
      />
      <ChampionCell
        name={r.defender_champion_name}
        imageUrl={r.defender_image_url}
        stars={r.defender_stars}
        rank={r.defender_rank}
        ascension={r.defender_ascension}
        isSaga={r.defender_is_saga_defender}
        sagaMode='defender'
        dataCy='fight-record-defender'
      />
      <td
        className={cn(COMPACT_COL, 'py-2')}
        data-cy='fight-record-node'
      >
        {r.node_number}
      </td>
      <ChampionIconList
        champions={r.synergies}
        dataCy='fight-record-synergies'
      />
      <ChampionIconList
        champions={r.prefights}
        dataCy='fight-record-prefights'
      />
      <td
        className={cn(COMPACT_COL, 'py-2', r.ko_count ? 'text-red-500' : 'text-green-500')}
        data-cy='fight-record-ko'
      >
        {r.ko_count}
      </td>
      {/* Tag over the full name — 5 chars max instead of a whole alliance name. */}
      <td
        className={cn(COMPACT_COL, 'py-2 whitespace-nowrap')}
        title={r.alliance_name}
        data-cy='fight-record-alliance'
      >
        {r.alliance_tag ? `[${r.alliance_tag}]` : r.alliance_name}
      </td>
      <td
        className={cn(COMPACT_COL, 'py-2 whitespace-nowrap')}
        data-cy='fight-record-season'
      >
        {r.season_number != null ? `S${r.season_number}` : '—'}
      </td>
      {!exporting && <td className={cn(COMPACT_COL, 'py-2')}>{r.tier}</td>}
      {!exporting && (
        <td className={cn(COMPACT_COL, 'py-2 whitespace-nowrap')}>
          {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
        </td>
      )}
      {!exporting && <NoteCell record={r} />}
    </tr>
  )
}
