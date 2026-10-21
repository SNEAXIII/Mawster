'use client'

import { useEffect } from 'react'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import LabeledSlider from '@/components/labeled-slider'
import { SearchInput } from '@/components/search-input'
import { CollapsibleSection } from '@/components/collapsible-section'
import { getChampionImageUrl } from '@/app/services/champions'
import { type RosterEntry, RARITIES, RARITY_LABELS } from '@/app/services/roster'
import { MAX_SIGNATURE } from '@/components/roster/roster-filters'
import { useAddChampionForm } from '@/hooks/use-add-champion-form'

const FORM_SLIDER = 'w-full max-w-sm gap-2'

interface AddChampionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedAccountId: string | null
  roster: RosterEntry[]
  initialEntry?: RosterEntry | null
  onSuccess: (updatedRoster: RosterEntry[]) => void
}

export default function AddChampionForm({
  open,
  onOpenChange,
  selectedAccountId,
  roster,
  initialEntry,
  onSuccess,
}: Readonly<AddChampionFormProps>) {
  const { t } = useI18n()
  const {
    championSearch,
    searchResults,
    selectedChampion,
    selectedRarity,
    setSelectedRarity,
    signatureValue,
    setSignatureValue,
    isPreferredAttacker,
    setIsPreferredAttacker,
    ascension,
    setAscension,
    adding,
    handleChampionSearchChange,
    handleSelectChampion,
    handleSubmit,
    reset,
    prefillFromEntry,
    searchInputRef,
    formRef,
  } = useAddChampionForm(selectedAccountId)

  // Pre-fill when opening for an existing entry, reset when closing
  useEffect(() => {
    if (open && initialEntry) {
      prefillFromEntry(initialEntry)
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        searchInputRef.current?.focus()
      }, 100)
    } else if (open) {
      requestAnimationFrame(() => searchInputRef.current?.focus())
    } else {
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialEntry])

  const existingEntries = selectedChampion
    ? roster.filter((r) => r.champion_id === selectedChampion.id)
    : []

  const submit = async () => {
    const updated = await handleSubmit()
    if (updated) onSuccess(updated)
  }

  return (
    <div
      ref={formRef}
      className='mb-6'
    >
      <CollapsibleSection
        title={t.roster.addOrUpdate}
        open={open}
        onOpenChange={onOpenChange}
      >
        <div className='grid gap-x-8 lg:grid-cols-2'>
          {/* Champion search */}
          <div className='mb-3'>
            <label className='block text-sm font-medium mb-1'>{t.roster.champion}</label>
            <SearchInput
              ref={searchInputRef}
              placeholder={t.roster.searchChampion}
              value={championSearch}
              onChange={handleChampionSearchChange}
              data-cy='champion-search'
            />

            {/* Search results dropdown */}
            {searchResults.length > 0 && !selectedChampion && (
              <ScrollArea className='border rounded-md mt-1 max-h-48 shadow-md'>
                {searchResults.map((c) => (
                  <button
                    key={c.id}
                    className='w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 transition-colors'
                    onClick={() => handleSelectChampion(c)}
                    data-cy={`champion-result-${c.name}`}
                  >
                    {c.image_url && (
                      <img
                        src={getChampionImageUrl(c.image_url, 40) ?? ''}
                        alt={c.name}
                        className='size-8 rounded object-cover'
                      />
                    )}
                    <span>{c.name}</span>
                    <span className='text-xs text-muted-foreground ml-auto'>
                      {c.champion_class}
                    </span>
                  </button>
                ))}
              </ScrollArea>
            )}

            {/* Selected champion preview */}
            {selectedChampion && (
              <div
                className='mt-1'
                data-cy='champion-selected-preview'
              >
                <div className='flex items-center gap-2 text-sm text-primary'>
                  {selectedChampion.image_url && (
                    <img
                      src={getChampionImageUrl(selectedChampion.image_url, 40) ?? ''}
                      alt={selectedChampion.name}
                      className='size-6 rounded'
                    />
                  )}
                  <span className='font-medium'>{selectedChampion.name}</span>
                  <span className='text-muted-foreground'>({selectedChampion.champion_class})</span>
                </div>
                {existingEntries.length > 0 && (
                  <div
                    className='mt-1.5 ml-8 flex flex-col gap-0.5'
                    data-cy='already-in-roster'
                  >
                    <span className='text-xs text-amber-500 font-medium'>
                      {t.roster.alreadyInRoster}
                    </span>
                    {existingEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className='text-xs text-amber-500 flex items-center gap-1'
                      >
                        <span className='font-semibold text-amber-500'>
                          {RARITY_LABELS[entry.rarity] ?? entry.rarity}
                        </span>
                        <span className='text-amber-500'>· sig {entry.signature}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <LabeledSlider
              title={<Label>{t.roster.rarity}</Label>}
              max={RARITIES.length - 1}
              value={[Math.max(0, (RARITIES as readonly string[]).indexOf(selectedRarity))]}
              onChange={([i]) => setSelectedRarity(RARITIES[i])}
              format={(i) => RARITY_LABELS[RARITIES[i]]}
              cy='rarity'
              className={`${FORM_SLIDER} mb-4`}
            />

            {/* The input keeps exact values reachable; 200 steps are too fine to drag on a phone */}
            <LabeledSlider
              title={<Label>{t.roster.signature}</Label>}
              valueSlot={
                <Input
                  type='number'
                  min={0}
                  className='h-7 w-16 text-right text-xs tabular-nums'
                  value={signatureValue}
                  onChange={(e) =>
                    setSignatureValue(
                      Math.min(MAX_SIGNATURE, Math.max(0, Number.parseInt(e.target.value) || 0))
                    )
                  }
                  data-cy='sig-input'
                />
              }
              max={MAX_SIGNATURE}
              value={[signatureValue]}
              onChange={([v]) => setSignatureValue(v)}
              format={String}
              cy='sig-slider'
              className={`${FORM_SLIDER} mb-4`}
            />

            {/* Preferred Attacker */}
            <div className='mb-4'>
              <div className='flex items-center gap-2'>
                <Checkbox
                  id='preferred-attacker'
                  checked={isPreferredAttacker}
                  onCheckedChange={(checked) => setIsPreferredAttacker(checked === true)}
                  data-cy='preferred-attacker-checkbox'
                />
                <Label
                  htmlFor='preferred-attacker'
                  className='cursor-pointer select-none'
                >
                  {t.roster.preferredAttacker}
                </Label>
              </div>
            </div>

            {/* Ascension */}
            <div className='mb-4'>
              <LabeledSlider
                title={<Label>Ascension</Label>}
                className={FORM_SLIDER}
                max={2}
                value={[ascension]}
                onChange={([level]) => setAscension(level)}
                format={(level) => (level === 0 ? 'None' : `A${level}`)}
                disabled={!selectedChampion?.is_ascendable}
                cy='ascension'
              />
              {selectedChampion && !selectedChampion.is_ascendable && (
                <p className='text-xs text-muted-foreground mt-1'>
                  This champion cannot be ascended.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className='flex gap-2'>
          <Button
            onClick={submit}
            disabled={!selectedChampion || adding}
            data-cy='champion-submit'
          >
            {adding ? t.common.loading : t.roster.addOrUpdateButton}
          </Button>
        </div>
      </CollapsibleSection>
    </div>
  )
}
