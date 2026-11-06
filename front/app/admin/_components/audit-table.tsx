'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { formatDate } from '@/app/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AuditEntry, AuditResult } from '@/app/services/admin-audit'

const RESULT_VARIANTS: Record<AuditResult, 'secondary' | 'outline' | 'destructive'> = {
  success: 'secondary',
  refused: 'outline',
  error: 'destructive',
}

function AuditRow({ entry }: Readonly<{ entry: AuditEntry }>) {
  const { t, locale } = useI18n()
  const s = t.admin.audit
  const [open, setOpen] = useState(false)

  return (
    <Collapsible
      asChild
      open={open}
      onOpenChange={setOpen}
    >
      <TableBody className='border-b'>
        <CollapsibleTrigger asChild>
          <TableRow
            className='group cursor-pointer'
            data-cy='audit-row'
          >
            <TableCell className='py-1 text-xs whitespace-nowrap'>
              {formatDate(entry.created_at, locale, 'long')}
            </TableCell>
            <TableCell className='py-1 text-xs whitespace-nowrap'>
              {entry.user_login ?? s.anonymous}
            </TableCell>
            <TableCell className='py-1 font-mono text-xs whitespace-nowrap'>
              {entry.method} {entry.route}
            </TableCell>
            <TableCell className='py-1 text-xs tabular-nums'>{entry.status_code}</TableCell>
            <TableCell className='py-1'>
              <Badge
                variant={RESULT_VARIANTS[entry.result]}
                className='px-1.5 py-0 text-[10px]'
              >
                {s.results[entry.result]}
              </Badge>
            </TableCell>
            {/* max-w-0 with w-full: this column takes what is left and truncates there. */}
            <TableCell
              className='text-muted-foreground w-full max-w-0 min-w-40 truncate py-1 font-mono text-[11px]'
              data-cy='audit-details-preview'
            >
              {entry.details && JSON.stringify(entry.details)}
            </TableCell>
            <TableCell className='py-1 text-right'>
              {/* No handler: the click bubbles to the row, the keyboard reaches it through here. */}
              <button
                type='button'
                className='hover:bg-muted rounded-sm p-0.5 align-middle'
                aria-label={s.toggleDetails}
                aria-expanded={open}
                data-cy='audit-toggle'
              >
                <ChevronRight className='h-4 w-4 transition-transform group-data-[state=open]:rotate-90' />
              </button>
            </TableCell>
          </TableRow>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <TableRow className='hover:bg-transparent'>
            <TableCell
              colSpan={7}
              className='bg-muted/30'
              data-cy='audit-details'
            >
              {entry.details ? (
                <pre className='font-mono text-xs wrap-anywhere whitespace-pre-wrap'>
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              ) : (
                <p className='text-muted-foreground text-sm'>{s.noDetails}</p>
              )}
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </TableBody>
    </Collapsible>
  )
}

export default function AuditTable({ entries }: Readonly<{ entries: AuditEntry[] }>) {
  const { t } = useI18n()
  const s = t.admin.audit

  if (entries.length === 0) {
    return (
      <p
        className='text-muted-foreground py-12 text-center text-sm'
        data-cy='audit-empty'
      >
        {s.empty}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className='h-8 text-xs'>{s.columnDate}</TableHead>
          <TableHead className='h-8 text-xs'>{s.columnAuthor}</TableHead>
          <TableHead className='h-8 text-xs'>{s.columnEndpoint}</TableHead>
          <TableHead className='h-8 text-xs'>{s.columnStatus}</TableHead>
          <TableHead className='h-8 text-xs'>{s.columnResult}</TableHead>
          <TableHead className='h-8 text-xs'>{s.columnDetails}</TableHead>
          <TableHead className='h-8'>
            <span className='sr-only'>{s.toggleDetails}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      {entries.map((entry) => (
        <AuditRow
          key={entry.id}
          entry={entry}
        />
      ))}
    </Table>
  )
}
