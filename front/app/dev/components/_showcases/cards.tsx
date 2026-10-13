'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Section, Variant } from '../_components/showcase-section'

const BADGE_VARIANTS = ['default', 'secondary', 'outline', 'destructive'] as const

export default function CardsShowcase() {
  return (
    <>
      <Section title='Badge'>
        {BADGE_VARIANTS.map((variant) => (
          <Variant
            key={variant}
            label={variant}
          >
            <Badge variant={variant}>Season 62</Badge>
          </Variant>
        ))}
      </Section>

      <Section title='Card'>
        <Card className='w-80'>
          <CardHeader>
            <CardTitle>Alliance war — Season 62</CardTitle>
            <CardDescription>Tier 4 · Battlegroup 2</CardDescription>
          </CardHeader>
          <CardContent className='text-sm'>
            30 defenders placed out of 50. Attack phase starts in 6h.
          </CardContent>
          <CardFooter className='gap-2'>
            <Button size='sm'>Open war</Button>
            <Button
              size='sm'
              variant='outline'
            >
              Defense
            </Button>
          </CardFooter>
        </Card>

        <Card className='w-56'>
          <CardHeader className='pb-2'>
            <CardDescription>Roster rating</CardDescription>
            <CardTitle className='text-3xl tabular-nums'>412 870</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant='secondary'>+3 120 this week</Badge>
          </CardContent>
        </Card>
      </Section>
    </>
  )
}
