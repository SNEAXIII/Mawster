'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchInput } from '@/components/search-input'
import ChampionPortrait from '@/components/champion-portrait'
import { cn } from '@/app/lib/utils'
import { RARITIES, RARITY_LABELS, rarityIndex, shortenChampionName } from '@/app/services/roster'
import { parseRarity } from '@/app/game/defense/_components/defense-utils'
import { getClassColors } from '@/app/lib/champion-class'
import type { Champion } from '@/app/services/champions'
import { useChampionPages } from '@/hooks/use-champion-catalog'
import type { WarPlacement } from '@/app/services/war'
import { Separator } from '@/components/ui/separator'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import LabeledSlider from '@/components/labeled-slider'
import AttackerEntryRow from './attacker-entry-row'
import { useLastDefenderRarity } from './use-last-defender-rarity'

interface WarDefenderSelectorProps {
  open: boolean
  onClose: () => void
  nodeNumber: number
  currentPlacement?: WarPlacement
  onSelect: (
    championId: string,
    championName: string,
    stars: number,
    rank: number,
    ascension: number
  ) => void
}

export default function WarDefenderSelector({
  open,
  onClose,
  nodeNumber,
  currentPlacement,
  onSelect,
}: Readonly<WarDefenderSelectorProps>) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const { champions, page, totalPages, loading, loadMore } = useChampionPages(open, search)

  // Selection state
  const [selected, setSelected] = useState<Champion | null>(null)
  const { last, remember } = useLastDefenderRarity()
  const [rankIndex, setRankIndex] = useState(0)
  const [ascension, setAscension] = useState(0)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const rarity = RARITIES[rankIndex]
  const placedAscension = selected?.is_ascendable ? ascension : 0

  useEffect(() => {
    if (open) {
      setRankIndex(rarityIndex(`${last.stars}r${last.rank}`))
      setAscension(last.ascension)
    } else {
      setSelected(null)
      setSearch('')
    }
  }, [open, last])

  const handleConfirm = () => {
    if (!selected) return
    // Same champion only changes rank/ascension: the attacker stays.
    const replacesAttacked =
      currentPlacement?.attacker_champion_user_id && currentPlacement.champion_id !== selected.id
    if (replacesAttacked) {
      setShowReplaceConfirm(true)
      return
    }
    doSelect()
  }

  const doSelect = () => {
    if (!selected) return
    const { stars, rank } = parseRarity(rarity)
    onSelect(selected.id, selected.name, stars, rank, placedAscension)
    remember({ stars, rank, ascension: selected.is_ascendable ? ascension : last.ascension })
    onClose()
  }

  return (
    <>
      <ConfirmationDialog
        open={showReplaceConfirm}
        onOpenChange={(v) => setShowReplaceConfirm(v)}
        title={t.game.war.replaceDefenderWithAttackerTitle}
        description={t.game.war.replaceDefenderWithAttackerDesc}
        variant='destructive'
        onConfirm={doSelect}
        data-cy='war-replace-defender-confirm'
      >
        {selected && (
          <div className='flex flex-col gap-3 mt-2'>
            <div className='flex items-center gap-3 px-2'>
              <ChampionPortrait
                imageUrl={selected.image_url}
                name={selected.name}
                rarity={rarity}
                size={48}
              />
              <div>
                <div className='text-sm font-semibold'>{selected.name}</div>
                <div className='text-xs text-muted-foreground'>
                  {RARITY_LABELS[rarity]}
                  {placedAscension > 0 && (
                    <span className='text-purple-400'> · A{placedAscension}</span>
                  )}
                </div>
              </div>
            </div>
            {currentPlacement && (
              <>
                <Separator />
                <div className='flex justify-center'>
                  <AttackerEntryRow
                    placement={currentPlacement}
                    mode='full'
                    readonly
                  />
                </div>
              </>
            )}
          </div>
        )}
      </ConfirmationDialog>

      <Dialog
        open={open}
        onOpenChange={(v) => !v && onClose()}
      >
        <DialogContent
          className='max-w-2xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0'
          data-cy='war-defender-search'
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            searchInputRef.current?.focus()
          }}
        >
          <DialogHeader className='px-4 py-4 border-b'>
            <DialogTitle data-cy='war-defender-selector-title'>
              {(currentPlacement
                ? t.game.war.selectDefenderPlaced.replace(
                    '{champion}',
                    currentPlacement.champion_name
                  )
                : t.game.war.selectDefenderEmpty
              ).replace('{node}', String(nodeNumber))}
            </DialogTitle>
          </DialogHeader>

          {currentPlacement && (
            <>
              <div className='px-6 py-2'>
                <AttackerEntryRow
                  placement={currentPlacement}
                  mode='full'
                />
              </div>
              <Separator />
            </>
          )}

          {!selected ? (
            <>
              <div className='p-3 border-b'>
                <SearchInput
                  ref={searchInputRef}
                  value={search}
                  onChange={setSearch}
                  placeholder={t.game.war.searchChampion}
                  data-cy='war-champion-search'
                />
              </div>
              <div className='overflow-y-auto flex-1 p-3'>
                {loading && champions.length === 0 ? (
                  <div className='text-center text-muted-foreground py-8'>
                    {t.game.war.loadingChampions}
                  </div>
                ) : (
                  <>
                    <div className='grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2'>
                      {champions.map((champ) => {
                        const classColors = getClassColors(champ.champion_class)
                        return (
                          <button
                            key={champ.id}
                            className={cn(
                              'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                              'hover:ring-2 hover:ring-primary/60 hover:border-primary/60'
                            )}
                            onClick={() => setSelected(champ)}
                            data-cy={`war-champion-card-${champ.name.replaceAll(/\s+/g, '-')}`}
                          >
                            <ChampionPortrait
                              imageUrl={champ.image_url}
                              name={champ.name}
                              rarity='7r3'
                              size={48}
                            />
                            <span className='text-[10px] text-center truncate w-full leading-tight'>
                              {shortenChampionName(champ.name)}
                            </span>
                            <span className={cn('text-[9px] font-medium', classColors.label)}>
                              {champ.champion_class}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {page < totalPages && (
                      <div className='text-center mt-4'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => void loadMore()}
                          data-cy='war-champion-load-more'
                          disabled={loading}
                        >
                          {t.game.war.loadMore}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className='flex-1 overflow-y-auto p-4 flex flex-col gap-4'>
              <div className='flex items-center gap-3'>
                <ChampionPortrait
                  imageUrl={selected.image_url}
                  name={selected.name}
                  rarity={rarity}
                  size={56}
                />
                <div>
                  <div className='font-semibold'>{selected.name}</div>
                  <div className='text-sm text-muted-foreground'>{selected.champion_class}</div>
                </div>
                <Button
                  variant='ghost'
                  size='sm'
                  className='ml-auto'
                  onClick={() => setSelected(null)}
                >
                  {t.game.war.changeChampion}
                </Button>
              </div>

              <LabeledSlider
                max={RARITIES.length - 1}
                value={[rankIndex]}
                onChange={([i]) => setRankIndex(i)}
                format={(i) => RARITY_LABELS[RARITIES[i]]}
                cy='war-defender-rank'
                className='w-full'
                title={<span className='text-sm font-medium'>{t.game.war.rarity}</span>}
              />
              {selected.is_ascendable && (
                <LabeledSlider
                  max={2}
                  value={[ascension]}
                  onChange={([a]) => setAscension(a)}
                  format={(a) => (a === 0 ? t.game.war.ascensionNone : `A${a}`)}
                  cy='war-defender-ascension'
                  className='w-full'
                  title={<span className='text-sm font-medium'>{t.game.war.ascension}</span>}
                />
              )}

              <div className='mt-auto pt-4 border-t flex justify-end gap-2'>
                <Button
                  variant='outline'
                  onClick={onClose}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  onClick={handleConfirm}
                  data-cy='war-confirm-place'
                >
                  {t.game.war.placeOnNode.replace('{node}', String(nodeNumber))}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
