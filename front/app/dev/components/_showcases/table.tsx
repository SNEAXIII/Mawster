'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ClassChip } from '@/components/class-chip'
import { ROSTER_ENTRIES } from '@/app/dev/_mocks'
import { Section } from '../_components/showcase-section'

export default function TableShowcase() {
  return (
    <Section title='Table'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Champion</TableHead>
            <TableHead>Class</TableHead>
            <TableHead>Rarity</TableHead>
            <TableHead className='text-right'>Signature</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROSTER_ENTRIES.map((entry, i) => (
            <TableRow
              key={entry.id}
              data-state={i === 1 ? 'selected' : undefined}
            >
              <TableCell className='font-medium'>{entry.champion_name}</TableCell>
              <TableCell>
                <ClassChip
                  championClass={entry.champion_class}
                  size='sm'
                  variant='pill'
                />
              </TableCell>
              <TableCell>{entry.rarity}</TableCell>
              <TableCell className='text-right tabular-nums'>{entry.signature}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}
