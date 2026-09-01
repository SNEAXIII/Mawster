'use client'
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/app/lib/utils'
import { COMPACT_COL, GROW_COL, type KnowledgeBaseColumn } from './knowledge-base-columns'

type SortState = Readonly<{
  sortBy: string
  sortOrder: 'asc' | 'desc'
}>

function SortIcon({ col, sortBy, sortOrder }: SortState & Readonly<{ col: string }>) {
  if (sortBy !== col) return <ArrowUpDown className='ml-1 h-3 w-3 inline opacity-40' />
  return sortOrder === 'asc' ? (
    <ArrowUp className='ml-1 h-3 w-3 inline' />
  ) : (
    <ArrowDown className='ml-1 h-3 w-3 inline' />
  )
}

const TH_BASE = 'py-2 text-xs font-semibold text-muted-foreground'

type KnowledgeBaseTableHeadProps = Readonly<{
  columns: ReadonlyArray<KnowledgeBaseColumn>
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSort: (col: string) => void
  /** Export mode renders every header as plain text — sort arrows are UI noise on an image. */
  exporting: boolean
}>

export default function KnowledgeBaseTableHead({
  columns,
  sortBy,
  sortOrder,
  onSort,
  exporting,
}: KnowledgeBaseTableHeadProps) {
  return (
    <thead className='bg-muted/50'>
      <tr>
        {columns.map(({ id, col, label, compact, grow }) => {
          const width = compact ? COMPACT_COL : grow ? GROW_COL : 'px-3'
          return col && !exporting ? (
            <th
              key={id}
              className={cn(
                TH_BASE,
                'text-left cursor-pointer whitespace-nowrap select-none hover:text-foreground',
                width
              )}
              onClick={() => onSort(col)}
            >
              {label}
              <SortIcon
                col={col}
                sortBy={sortBy}
                sortOrder={sortOrder}
              />
            </th>
          ) : (
            <th
              key={id}
              className={cn(TH_BASE, width, !compact && 'text-left')}
            >
              {label}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
