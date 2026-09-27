'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { FullPageSpinner } from '@/components/full-page-spinner'
import type { SeasonFormat } from '@/app/services/season'
import { useTemplates } from '../_hooks/use-templates'
import { templateNodeToPlacement } from './plan-node-adapter'
import TemplateChampionPicker from './template-champion-picker'
import TemplateToolbar from './template-toolbar'

const WarMap = dynamic(() => import('./war-map'), { loading: () => <FullPageSpinner /> })

export default function TemplateWorkspace({
  allianceId,
  format,
  bg,
}: Readonly<{ allianceId: string; format: SeasonFormat; bg: number }>) {
  const state = useTemplates(allianceId, format)
  const [pickerNode, setPickerNode] = useState<number | null>(null)
  const placements = (state.selected?.nodes ?? []).map((n) => templateNodeToPlacement(n, bg))

  return (
    <div className='flex flex-col gap-4'>
      <TemplateToolbar state={state} />
      {state.selected && (
        <div className='overflow-x-auto rounded-xl border bg-card p-2 shadow-sm'>
          <WarMap
            placements={placements}
            onNodeClick={setPickerNode}
            onRemove={(node) => state.removeNode(node)}
            canManage
            hidePseudo
            format={format}
          />
        </div>
      )}
      <TemplateChampionPicker
        node={pickerNode}
        onClose={() => setPickerNode(null)}
        onPick={(champion) => {
          if (pickerNode !== null) state.placeChampion(pickerNode, champion.id, champion.name)
          setPickerNode(null)
        }}
      />
    </div>
  )
}
