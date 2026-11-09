'use client'

import { useState } from 'react'
import { FiCheck, FiX } from 'react-icons/fi'
import { useI18n } from '@/app/i18n'
import ChampionThumbnail from '@/components/champion-thumbnail'
import { Button } from '@/components/ui/button'
import type { AdminAscensionRequest } from '@/app/services/ascension-requests'

interface AscensionRequestsSectionProps {
  requests: AdminAscensionRequest[]
  onAccept: (id: string) => Promise<void>
  onRefuse: (id: string) => Promise<void>
}

export default function AscensionRequestsSection({
  requests,
  onAccept,
  onRefuse,
}: Readonly<AscensionRequestsSectionProps>) {
  const { t } = useI18n()
  const labels = t.champions.ascensionRequest
  const [busy, setBusy] = useState(false)

  if (requests.length === 0) return null

  const run = async (action: (id: string) => Promise<void>, id: string) => {
    setBusy(true)
    await action(id)
    setBusy(false)
  }

  return (
    <section
      className='flex flex-col gap-2'
      data-cy='ascension-requests-section'
    >
      <h3 className='text-sm font-semibold text-foreground'>{labels.listTitle}</h3>
      <ul className='divide-y divide-border rounded-md border border-border bg-card'>
        {requests.map((request) => (
          <li
            key={request.id}
            className='flex flex-wrap items-center gap-3 p-2'
            data-cy='ascension-request-row'
          >
            <ChampionThumbnail
              imageUrl={request.image_url}
              name={request.champion_name}
              size={40}
              className='rounded'
            />
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>{request.champion_name}</p>
              <p className='truncate text-xs text-muted-foreground'>
                {labels.requestedBy.replace('{login}', request.requester_login)}
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant='outline'
                disabled={busy}
                onClick={() => run(onAccept, request.id)}
                data-cy='ascension-request-accept'
              >
                <FiCheck className='mr-1 size-4' />
                {labels.accept}
              </Button>
              <Button
                size='sm'
                variant='outline'
                disabled={busy}
                onClick={() => run(onRefuse, request.id)}
                data-cy='ascension-request-refuse'
              >
                <FiX className='mr-1 size-4' />
                {labels.refuse}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
