'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useI18n } from '@/app/i18n'
import { formatDate } from '@/app/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
            <TableCell className='whitespace-nowrap'>
              {formatDate(entry.created_at, locale, 'long')}
            </TableCell>
            <TableCell>{entry.user_login ?? s.anonymous}</TableCell>
            <TableCell className='font-mono text-xs'>
              {entry.method} {entry.route}
            </TableCell>
            <TableCell className='tabular-nums'>{entry.status_code}</TableCell>
            <TableCell>
              <Badge variant={RESULT_VARIANTS[entry.result]}>{s.results[entry.result]}</Badge>
            </TableCell>
            <TableCell className='text-right'>
              {/* No handler: the click bubbles to the row, the keyboard reaches it through here. */}
              <Button
                variant='ghost'
                size='icon'
                aria-label={s.toggleDetails}
                aria-expanded={open}
                data-cy='audit-toggle'
              >
                <ChevronRight className='h-4 w-4 transition-transform group-data-[state=open]:rotate-90' />
              </Button>
            </TableCell>
          </TableRow>
        </CollapsibleTrigger>
        <CollapsibleContent asChild>
          <TableRow className='hover:bg-transparent'>
            <TableCell
              colSpan={6}
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
          <TableHead>{s.columnDate}</TableHead>
          <TableHead>{s.columnAuthor}</TableHead>
          <TableHead>{s.columnEndpoint}</TableHead>
          <TableHead>{s.columnStatus}</TableHead>
          <TableHead>{s.columnResult}</TableHead>
          <TableHead>
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
