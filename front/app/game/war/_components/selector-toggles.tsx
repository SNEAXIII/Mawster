'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Switch } from '@/components/ui/switch'

interface SelectorTogglesProps {
  showDefenders: boolean
  onShowDefenders: (v: boolean) => void
  showCatalog: boolean
  onShowCatalog: (v: boolean) => void
  dataCyPrefix: string
}

/** Toggle state for a selector dialog, back to defaults whenever it closes. */
export function useSelectorToggles(open: boolean) {
  const [showDefenders, onShowDefenders] = useState(true)
  const [showCatalog, onShowCatalog] = useState(false)
  useEffect(() => {
    if (open) return
    onShowDefenders(true)
    onShowCatalog(false)
  }, [open])
  return { showDefenders, onShowDefenders, showCatalog, onShowCatalog }
}

export default function SelectorToggles({
  showDefenders,
  onShowDefenders,
  showCatalog,
  onShowCatalog,
  dataCyPrefix,
}: Readonly<SelectorTogglesProps>) {
  const { t } = useI18n()
  const u = t.game.war.unrecorded
  return (
    <div className='px-4 pb-3 flex flex-wrap items-center gap-4 text-xs'>
      <label className='flex items-center gap-2'>
        <Switch
          checked={showDefenders}
          onCheckedChange={onShowDefenders}
          data-cy={`${dataCyPrefix}-toggle-defenders`}
        />
        {u.showDefenders}
      </label>
      <label className='flex items-center gap-2'>
        <Switch
          checked={showCatalog}
          onCheckedChange={onShowCatalog}
          data-cy={`${dataCyPrefix}-toggle-catalog`}
        />
        {u.showCatalog}
      </label>
    </div>
  )
}
