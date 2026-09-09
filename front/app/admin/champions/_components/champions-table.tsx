'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/app/i18n'
import type { Champion, ChampionOrderBy, ChampionOrderDir } from '@/app/services/champions'
import type { ChampionAttribute } from '@/app/admin/_viewmodels/champion-filters'
import ChampionTableRow from './champion-table-row'

interface ChampionsTableProps {
  champions: Champion[]
  isLoading: boolean
  perPage: number
  orderBy: ChampionOrderBy
  orderDir: ChampionOrderDir
  onSort: (field: ChampionOrderBy) => void
  sagaDisabled?: boolean
  onToggleAttribute: (champion: Champion, attribute: ChampionAttribute) => void
  onSaveAlias: (championId: string, alias: string) => Promise<boolean>
  onDelete: (champion: Champion) => void
}

export default function ChampionsTable({
  champions,
  isLoading,
  perPage,
  orderBy,
  orderDir,
  onSort,
  sagaDisabled,
  onToggleAttribute,
  onSaveAlias,
  onDelete,
}: Readonly<ChampionsTableProps>) {
  const { t } = useI18n()

  function SortIcon({ field }: Readonly<{ field: ChampionOrderBy }>) {
    if (orderBy !== field) return <ChevronsUpDown className='size-3.5 opacity-40' />
    return orderDir === 'asc' ? (
      <ArrowUp className='size-3.5' />
    ) : (
      <ArrowDown className='size-3.5' />
    )
  }

  function SortableHeader({ field, label }: Readonly<{ field: ChampionOrderBy; label: string }>) {
    return (
      <th className='text-left p-3'>
        <button
          type='button'
          onClick={() => onSort(field)}
          className='flex items-center gap-1 hover:text-foreground'
          data-cy={`champions-sort-${field}`}
        >
          {label}
          <SortIcon field={field} />
        </button>
      </th>
    )
  }

  if (isLoading) {
    return (
      <div className='flex flex-col gap-2'>
        {Array.from({ length: perPage }, (_, i) => (
          <Skeleton
            key={i}
            className='h-14 w-full'
          />
        ))}
      </div>
    )
  }

  if (champions.length === 0) {
    return <div className='text-center py-8 text-muted-foreground'>{t.champions.empty}</div>
  }

  return (
    <div
      className='overflow-x-auto'
      data-cy='champions-list'
    >
      <table className='w-full text-sm border-collapse'>
        <thead>
          <tr className='border-b bg-muted/50'>
            <th className='text-left p-3 w-16'>{t.champions.tableHeaders.image}</th>
            <SortableHeader
              field='name'
              label={t.champions.tableHeaders.name}
            />
            <SortableHeader
              field='champion_class'
              label={t.champions.tableHeaders.class}
            />
            <th className='text-left p-3'>{t.champions.tableHeaders.alias}</th>
            <th className='text-left p-3'>{t.champions.tableHeaders.attributes}</th>
            <th className='text-left p-3 w-24'>{t.champions.tableHeaders.actions}</th>
          </tr>
        </thead>
        <tbody>
          {champions.map((champion) => (
            <ChampionTableRow
              key={champion.id}
              champion={champion}
              sagaDisabled={sagaDisabled}
              onToggleAttribute={onToggleAttribute}
              onSaveAlias={onSaveAlias}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
