'use client'

import { useI18n } from '@/app/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { X } from 'lucide-react'
import type { PaginatedVisionImports } from '@/app/services/vision-stats'
import type { UserFilter } from '../_viewmodels/use-vision-stats-viewmodel'

interface VisionStatsImportsProps {
  data: PaginatedVisionImports
  statusFilter: string
  onStatusChange: (status: string) => void
  userFilter: UserFilter | null
  onClearUser: () => void
  onPageChange: (page: number) => void
}

const ALL_STATUSES = 'all'

export default function VisionStatsImports({
  data,
  statusFilter,
  onStatusChange,
  userFilter,
  onClearUser,
  onPageChange,
}: Readonly<VisionStatsImportsProps>) {
  const { t } = useI18n()
  const s = t.admin.visionStats

  const statusLabels: Record<string, string> = {
    awaiting_upload: s.statusAwaitingUpload,
    pending: s.statusPending,
    running: s.statusRunning,
    done: s.statusDone,
    failed: s.statusFailed,
    confirmed: s.statusConfirmed,
    cancelled: s.statusCancelled,
  }

  // Status is a state, not a series: it wears the reserved status colors and
  // always ships with its label, never the colour alone.
  const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (status === 'confirmed') return 'default'
    if (status === 'failed') return 'destructive'
    if (status === 'cancelled') return 'outline'
    return 'secondary'
  }

  return (
    <Card data-cy='vision-imports-panel'>
      <CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2 pb-2'>
        <CardTitle className='text-base'>{s.importsTitle}</CardTitle>
        <div className='flex flex-wrap items-center gap-2'>
          {userFilter && (
            <Button
              variant='secondary'
              size='sm'
              onClick={onClearUser}
              data-cy='vision-imports-clear-user'
            >
              {s.filteredByUser.replace('{{login}}', userFilter.login)}
              <X className='ml-1 h-3 w-3' />
            </Button>
          )}
          <Select
            value={statusFilter || ALL_STATUSES}
            onValueChange={(value) => onStatusChange(value === ALL_STATUSES ? '' : value)}
          >
            <SelectTrigger
              className='w-44'
              data-cy='vision-imports-status-filter'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>{s.filterAllStatuses}</SelectItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <SelectItem
                  key={value}
                  value={value}
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {data.items.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>{s.importsEmpty}</p>
        ) : (
          <div className='overflow-x-auto'>
            <Table data-cy='vision-imports-table'>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.colDate}</TableHead>
                  <TableHead>{s.colUser}</TableHead>
                  <TableHead>{s.colAccount}</TableHead>
                  <TableHead>{s.colStatus}</TableHead>
                  <TableHead>{s.colProgress}</TableHead>
                  <TableHead>{s.colFailedScreens}</TableHead>
                  <TableHead>{s.colPredictions}</TableHead>
                  <TableHead>{s.colShared}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow
                    key={row.id}
                    data-cy='vision-imports-row'
                  >
                    <TableCell className='whitespace-nowrap'>
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className='font-medium'>{row.login}</TableCell>
                    <TableCell className='text-muted-foreground'>{row.game_pseudo}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>
                        {statusLabels[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className='tabular-nums'>
                      {row.screens_done}/{row.screens_total}
                    </TableCell>
                    <TableCell className='tabular-nums'>{row.jobs_failed}</TableCell>
                    <TableCell className='tabular-nums'>{row.predictions_total}</TableCell>
                    <TableCell>{row.share_dataset ? t.common.yes : t.common.no}</TableCell>
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
              data-cy='vision-imports-prev'
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
              data-cy='vision-imports-next'
            >
              {t.common.next}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
