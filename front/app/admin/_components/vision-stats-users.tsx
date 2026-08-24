'use client'

import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { PaginatedVisionUsers, VisionUserSort } from '@/app/services/vision-stats'

interface VisionStatsUsersProps {
  data: PaginatedVisionUsers
  sortBy: VisionUserSort
  sortOrder: 'asc' | 'desc'
  onSort: (column: VisionUserSort) => void
  onPageChange: (page: number) => void
  onSelectUser: (user: { id: string; login: string }) => void
}

export default function VisionStatsUsers({
  data,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onSelectUser,
}: Readonly<VisionStatsUsersProps>) {
  const { t } = useI18n()
  const s = t.admin.visionStats

  const columns: { key: VisionUserSort; label: string }[] = [
    { key: 'imports_total', label: s.colImports },
    { key: 'imports_confirmed', label: s.colConfirmed },
    { key: 'imports_cancelled', label: s.colCancelled },
    { key: 'imports_failed', label: s.colFailed },
    { key: 'screens_total', label: s.colScreens },
    { key: 'last_import_at', label: s.colLastImport },
  ]

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : t.common.never

  return (
    <Card data-cy='vision-users-panel'>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base'>{s.usersTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.items.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>{s.usersEmpty}</p>
        ) : (
          <div className='overflow-x-auto'>
            <Table data-cy='vision-users-table'>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.colUser}</TableHead>
                  <TableHead>{s.colAccounts}</TableHead>
                  {columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className='cursor-pointer select-none whitespace-nowrap'
                      onClick={() => onSort(column.key)}
                      data-cy={`vision-users-sort-${column.key}`}
                    >
                      <span className='inline-flex items-center gap-1'>
                        {column.label}
                        {sortBy === column.key &&
                          (sortOrder === 'desc' ? (
                            <ArrowDown className='h-3 w-3' />
                          ) : (
                            <ArrowUp className='h-3 w-3' />
                          ))}
                      </span>
                    </TableHead>
                  ))}
                  <TableHead>{s.colPredictions}</TableHead>
                  <TableHead>{s.colConfirmRate}</TableHead>
                  <TableHead>{s.colShared}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((user) => (
                  <TableRow
                    key={user.user_id}
                    data-cy='vision-users-row'
                  >
                    <TableCell className='font-medium'>{user.login}</TableCell>
                    <TableCell className='text-muted-foreground'>
                      {user.game_pseudos.join(', ') || '—'}
                    </TableCell>
                    <TableCell className='tabular-nums'>{user.imports_total}</TableCell>
                    <TableCell className='tabular-nums'>{user.imports_confirmed}</TableCell>
                    <TableCell className='tabular-nums'>{user.imports_cancelled}</TableCell>
                    <TableCell className='tabular-nums'>{user.imports_failed}</TableCell>
                    <TableCell className='tabular-nums'>{user.screens_total}</TableCell>
                    <TableCell className='whitespace-nowrap'>
                      {formatDate(user.last_import_at)}
                    </TableCell>
                    <TableCell className='tabular-nums'>{user.predictions_total}</TableCell>
                    <TableCell className='tabular-nums'>
                      {Math.round(user.confirm_rate * 100)}%
                    </TableCell>
                    <TableCell className='tabular-nums'>{user.shared_dataset_imports}</TableCell>
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => onSelectUser({ id: user.user_id, login: user.login })}
                        data-cy='vision-users-view-imports'
                      >
                        {s.viewImports}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data.pages > 1 && (
          <div className='mt-3 flex items-center justify-end gap-2 text-sm'>
            <Button
              variant='outline'
              size='sm'
              disabled={data.page <= 1}
              onClick={() => onPageChange(data.page - 1)}
              data-cy='vision-users-prev'
            >
              {t.common.previous}
            </Button>
            <span className='text-muted-foreground'>
              {t.common.page} {data.page}/{data.pages}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={data.page >= data.pages}
              onClick={() => onPageChange(data.page + 1)}
              data-cy='vision-users-next'
            >
              {t.common.next}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
