'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/search-input';
import { CollapsibleSection } from '@/components/collapsible-section';
import { Champion, getChampionImageUrl } from '@/app/services/champions';
import {
  RosterEntry,
  RARITIES,
  RARITY_LABELS,
  SIGNATURE_PRESETS,
} from '@/app/services/roster';

interface AddChampionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  championSearch: string;
  onChampionSearchChange: (value: string) => void;
  searchResults: Champion[];
  selectedChampion: Champion | null;
  onSelectChampion: (champion: Champion) => void;
  selectedRarity: string;
  onRarityChange: (rarity: string) => void;
  signatureValue: number;
  onSignatureChange: (value: number) => void;
  adding: boolean;
  onSubmit: () => void;
  roster: RosterEntry[];
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  formRef: React.RefObject<HTMLDivElement | null>;
}

export default function AddChampionForm({
  open,
  onOpenChange,
  championSearch,
  onChampionSearchChange,
  searchResults,
  selectedChampion,
  onSelectChampion,
  selectedRarity,
  onRarityChange,
  signatureValue,
  onSignatureChange,
  adding,
  onSubmit,
  roster,
  searchInputRef,
  formRef,
}: AddChampionFormProps) {
  const { t } = useI18n();

  const existingEntries = selectedChampion
    ? roster.filter((r) => r.champion_id === selectedChampion.id)
    : [];

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
            onChange={onChampionSearchChange}
          />

          {/* Search results dropdown */}
          {searchResults.length > 0 && !selectedChampion && (
            <div className="border rounded mt-1 max-h-48 overflow-y-auto bg-white shadow-md">
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2"
                  onClick={() => onSelectChampion(c)}
                >
                  {c.image_url && (
                    <img
                      src={getChampionImageUrl(c.image_url, 40) ?? ''}
                      alt={c.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                  )}
                  <span>{c.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {c.champion_class}
                  </span>
                </button>
              ))}
            </div>
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
                <div className="mt-1.5 ml-8 space-y-0.5">
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
          <label className="block text-sm font-medium mb-1">
            {t.roster.rarity}
          </label>
          <div className="flex flex-wrap gap-2">
            {RARITIES.map((r) => (
              <button
                key={r}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  selectedRarity === r
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => onRarityChange(r)}
              >
                {RARITY_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Signature field with quick-fill buttons */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">
            {t.roster.signature}
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              className="w-24"
              value={signatureValue}
              onChange={(e) =>
                onSignatureChange(Math.max(0, parseInt(e.target.value) || 0))
              }
            />
            <div className="flex gap-1">
              {SIGNATURE_PRESETS.map((v) => (
                <button
                  key={v}
                  className={`px-2 py-1 rounded text-xs border transition-colors ${
                    signatureValue === v
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}
                  onClick={() => onSignatureChange(v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-2">
          <Button onClick={onSubmit} disabled={!selectedChampion || adding}>
            {adding ? t.common.loading : t.roster.addOrUpdateButton}
          </Button>
        </div>
      </CollapsibleSection>
    </div>
  );
}
