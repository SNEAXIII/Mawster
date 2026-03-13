'use client';

import React, { useEffect } from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SearchInput } from '@/components/search-input';
import { CollapsibleSection } from '@/components/collapsible-section';
import { getChampionImageUrl } from '@/app/services/champions';
import {
  RosterEntry,
  RARITIES,
  RARITY_LABELS,
  SIGNATURE_PRESETS,
} from '@/app/services/roster';
import { useAddChampionForm } from '@/hooks/use-add-champion-form';

interface AddChampionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAccountId: string | null;
  roster: RosterEntry[];
  initialEntry?: RosterEntry | null;
  onSuccess: (updatedRoster: RosterEntry[]) => void;
}

export default function AddChampionForm({
  open,
  onOpenChange,
  selectedAccountId,
  roster,
  initialEntry,
  onSuccess,
}: Readonly<AddChampionFormProps>) {
  const { t } = useI18n();
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
  } = useAddChampionForm(selectedAccountId);

  // Pre-fill when opening for an existing entry, reset when closing
  useEffect(() => {
    if (open && initialEntry) {
      prefillFromEntry(initialEntry);
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        searchInputRef.current?.focus();
      }, 100);
    } else if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      reset();
    }
  }, [open, initialEntry]);

  const existingEntries = selectedChampion
    ? roster.filter((r) => r.champion_id === selectedChampion.id)
    : [];

  const submit = async () => {
    const updated = await handleSubmit();
    if (updated) onSuccess(updated);
  };

  return (
    <div ref={formRef} className="mb-6">
      <CollapsibleSection
        title={t.roster.addOrUpdate}
        open={open}
        onOpenChange={onOpenChange}
      >
        {/* Champion search */}
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">
            {t.roster.champion}
          </label>
          <SearchInput
            ref={searchInputRef}
            placeholder={t.roster.searchChampion}
            value={championSearch}
            onChange={handleChampionSearchChange}
            data-cy="champion-search"
          />

          {/* Search results dropdown */}
          {searchResults.length > 0 && !selectedChampion && (
            <ScrollArea className="border rounded-md mt-1 max-h-48 shadow-md">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 hover:bg-accent flex items-center gap-2 transition-colors"
                  onClick={() => handleSelectChampion(c)}
                  data-cy={`champion-result-${c.name}`}
                >
                  {c.image_url && (
                    <img
                      src={getChampionImageUrl(c.image_url, 40) ?? ''}
                      alt={c.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                  )}
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {c.champion_class}
                  </span>
                </button>
              ))}
            </ScrollArea>
          )}

          {/* Selected champion preview */}
          {selectedChampion && (
            <div className="mt-1">
              <div className="flex items-center gap-2 text-sm text-green-700">
                {selectedChampion.image_url && (
                  <img
                    src={getChampionImageUrl(selectedChampion.image_url, 40) ?? ''}
                    alt={selectedChampion.name}
                    className="w-6 h-6 rounded"
                  />
                )}
                <span className="font-medium">{selectedChampion.name}</span>
                <span className="text-gray-400">
                  ({selectedChampion.champion_class})
                </span>
              </div>
              {existingEntries.length > 0 && (
                <div className="mt-1.5 ml-8 space-y-0.5" data-cy="already-in-roster">
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    {t.roster.alreadyInRoster}
                  </span>
                  {existingEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"
                    >
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {RARITY_LABELS[entry.rarity] ?? entry.rarity}
                      </span>
                      <span className="text-amber-600 dark:text-amber-400">
                        · sig {entry.signature}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rarity buttons */}
        <div className="mb-3">
          <Label className="mb-1.5 block">{t.roster.rarity}</Label>
          <ToggleGroup
            type="single"
            value={selectedRarity}
            onValueChange={(val) => { if (val) setSelectedRarity(val); }}
            variant="outline"
            className="flex flex-wrap justify-start gap-1"
          >
            {RARITIES.map((r) => (
              <ToggleGroupItem
                key={r}
                value={r}
                data-cy={`rarity-${r}`}
                className="px-3 py-1.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {RARITY_LABELS[r]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {/* Signature field with quick-fill buttons */}
        <div className="mb-4">
          <Label className="mb-1.5 block">{t.roster.signature}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              className="w-24"
              value={signatureValue}
              onChange={(e) =>
                setSignatureValue(Math.max(0, parseInt(e.target.value) || 0))
              }
              data-cy="sig-input"
            />
            <ToggleGroup
              type="single"
              value={String(signatureValue)}
              onValueChange={(val) => { if (val) setSignatureValue(Number(val)); }}
              variant="outline"
              size="sm"
              className="flex gap-1"
            >
              {SIGNATURE_PRESETS.map((v) => (
                <ToggleGroupItem
                  key={v}
                  value={String(v)}
                  className="text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {v}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        {/* Preferred Attacker */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="preferred-attacker"
              checked={isPreferredAttacker}
              onCheckedChange={(checked) => setIsPreferredAttacker(checked === true)}
              data-cy="preferred-attacker-checkbox"
            />
            <Label htmlFor="preferred-attacker" className="cursor-pointer select-none">
              {t.roster.preferredAttacker}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            {t.roster.preferredAttackerHint}
          </p>
        </div>

        {/* Ascension */}
        <div className="mb-4">
          <Label className="mb-1.5 block">Ascension</Label>
          <ToggleGroup
            type="single"
            value={String(ascension)}
            onValueChange={(val) => { if (val) setAscension(Number(val)); }}
            variant="outline"
            className="flex justify-start gap-1"
          >
            {[0, 1, 2].map((level) => {
              const isAscendable = selectedChampion?.is_ascendable ?? false;
              const disabled = !isAscendable && level > 0;
              return (
                <ToggleGroupItem
                  key={level}
                  value={String(level)}
                  disabled={disabled}
                  data-cy={`ascension-${level}`}
                  className="px-3 py-1.5 text-sm data-[state=on]:bg-purple-600 data-[state=on]:text-white"
                >
                  {level === 0 ? 'None' : `A${level}`}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          {selectedChampion && !selectedChampion.is_ascendable && (
            <p className="text-xs text-muted-foreground mt-1">
              This champion cannot be ascended.
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-2">
          <Button onClick={submit} disabled={!selectedChampion || adding} data-cy="champion-submit">
            {adding ? t.common.loading : t.roster.addOrUpdateButton}
          </Button>
        </div>
      </CollapsibleSection>
    </div>
  );
}
