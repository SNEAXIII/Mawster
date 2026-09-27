'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchInput } from '@/components/search-input'
import ChampionPortrait from '@/components/champion-portrait'
import { getChampions, type Champion } from '@/app/services/champions'

interface TemplateChampionPickerProps {
  node: number | null
  onClose: () => void
  onPick: (champion: Champion) => void
}

export default function TemplateChampionPicker({
  node,
  onClose,
  onPick,
}: Readonly<TemplateChampionPickerProps>) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [champions, setChampions] = useState<Champion[]>([])

  useEffect(() => {
    if (node === null) return
    const handle = setTimeout(() => {
      getChampions({ search, size: 40, orderBy: 'name' })
        .then((res) => setChampions(res.champions))
        .catch(() => setChampions([]))
    }, 250)
    return () => clearTimeout(handle)
  }, [node, search])

  return (
    <Dialog
      open={node !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {t.game.defense.templates.pickChampion.replace('{node}', String(node ?? ''))}
          </DialogTitle>
        </DialogHeader>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t.game.defense.templates.searchChampion}
          data-cy='template-champion-search'
        />
        <div className='grid grid-cols-5 gap-2 max-h-96 overflow-y-auto'>
          {champions.map((champion) => (
            <button
              key={champion.id}
              type='button'
              className='flex flex-col items-center gap-1 rounded-md p-1 hover:bg-muted'
              onClick={() => onPick(champion)}
              data-cy={`template-champion-option-${champion.name}`}
            >
              <ChampionPortrait
                imageUrl={champion.image_url}
                name={champion.name}
                rarity='7r1'
                size={56}
              />
              <span className='truncate text-xs w-full text-center'>{champion.name}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
