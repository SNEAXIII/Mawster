'use client'
import type { RefObject } from 'react'
import { useI18n } from '@/app/i18n'
import type { FightRecord } from '@/app/services/fight-records'
import { cn } from '@/app/lib/utils'
import { buildKnowledgeBaseColumns } from './knowledge-base-columns'
import KnowledgeBaseTableHead from './knowledge-base-table-head'
import KnowledgeBaseTableRow from './knowledge-base-table-row'

interface Props {
  readonly records: ReadonlyArray<FightRecord>
  readonly loading: boolean
  readonly sortBy: string
  readonly sortOrder: 'asc' | 'desc'
  readonly onSort: (col: string) => void
  /** True while the table is being captured as a PNG — see `useImageExport`. */
  readonly exporting?: boolean
  readonly exportRef?: RefObject<HTMLDivElement | null>
}

export default function KnowledgeBaseTable({
  records,
  loading,
  sortBy,
  sortOrder,
  onSort,
  exporting = false,
  exportRef,
}: Props) {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase
  const columns = buildKnowledgeBaseColumns(kb, exporting)

  return (
    <div
      ref={exportRef}
      className={cn(
        'overflow-x-auto rounded-md border border-border',
        loading && 'opacity-50',
        // `dark` keeps the semantic tokens readable on the black export canvas
        // even when the user browses in light mode.
        exporting && 'dark bg-black p-2 w-max max-w-none overflow-visible'
      )}
    >
      {exporting && (
        <div className='flex items-center justify-between gap-6 px-1 pb-1 text-xs text-white'>
          <span className='font-semibold uppercase tracking-wide'>{kb.exportTitle}</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      )}
      <table
        className='w-full text-sm'
        data-cy='fight-records-table'
      >
        <KnowledgeBaseTableHead
          columns={columns}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
          exporting={exporting}
        />
        <tbody>
          {!loading && records.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className='px-3 py-8 text-center text-muted-foreground'
              >
                {kb.noData}
              </td>
            </tr>
          )}
          {!loading &&
            records.map((r) => (
              <KnowledgeBaseTableRow
                key={r.id}
                record={r}
                exporting={exporting}
              />
            ))}
        </tbody>
      </table>
    </div>
  )
}
