'use client'

import { FaDiscord } from 'react-icons/fa'
import { useI18n } from '@/app/i18n'
import { LANDING_LINKS } from '@/app/_components/landing/links'

// Beta notice with a Discord link — the AI import is new and the maintainer
// wants a direct feedback channel. The invite and handle live in LANDING_LINKS
// so there is a single source for them across the app.
export default function VisionBetaNotice() {
  const { t } = useI18n()
  return (
    <div className='flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs'>
      <span className='rounded bg-primary/15 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-primary'>
        {t.roster.importExport.vision.betaBadge}
      </span>
      <span className='text-muted-foreground'>{t.roster.importExport.vision.betaNotice}</span>
      <a
        href={LANDING_LINKS.discordSupport}
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex items-center gap-1 font-medium text-[#5865F2] hover:underline'
        data-cy='vision-beta-discord'
      >
        <FaDiscord className='size-4' />
        {LANDING_LINKS.discordHandle}
      </a>
    </div>
  )
}
