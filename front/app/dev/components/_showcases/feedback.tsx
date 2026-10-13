'use client'

import { Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBanner } from '@/components/error-banner'
import { Section, Variant } from '../_components/showcase-section'

const noop = () => {}

export default function FeedbackShowcase() {
  return (
    <>
      <Section title='Alert'>
        <Alert className='max-w-md'>
          <Info className='h-4 w-4' />
          <AlertTitle>War declared</AlertTitle>
          <AlertDescription>Placement phase ends in 18 hours.</AlertDescription>
        </Alert>
        <Alert
          variant='destructive'
          className='max-w-md'
        >
          <Info className='h-4 w-4' />
          <AlertTitle>Roster import failed</AlertTitle>
          <AlertDescription>The screenshot could not be read.</AlertDescription>
        </Alert>
      </Section>

      <Section title='ErrorBanner'>
        <Variant label='banner + dismiss'>
          <ErrorBanner
            message='Could not load the alliance.'
            onDismiss={noop}
          />
        </Variant>
        <Variant label='inline'>
          <ErrorBanner
            variant='inline'
            message='Pseudo already taken.'
          />
        </Variant>
      </Section>

      <Section title='Skeleton'>
        <div className='flex items-center gap-3'>
          <Skeleton className='h-12 w-12 rounded-full' />
          <div className='flex flex-col gap-2'>
            <Skeleton className='h-4 w-48' />
            <Skeleton className='h-4 w-32' />
          </div>
        </div>
      </Section>
    </>
  )
}
