'use client';

import { useState, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { Champion } from '@/app/services/champions';
import {
  RosterEntry,
  RARITIES,
  searchChampions,
  updateChampionInRoster,
  getRoster,
} from '@/app/services/roster';

export function useAddChampionForm(selectedAccountId: string | null) {
  const { t } = useI18n();

  const [championSearch, setChampionSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Champion[]>([]);
  const [selectedChampion, setSelectedChampion] = useState<Champion | null>(null);
  const [selectedRarity, setSelectedRarity] = useState<string>(RARITIES[0]);
  const [signatureValue, setSignatureValue] = useState(0);
  const [isPreferredAttacker, setIsPreferredAttacker] = useState(false);
  const [ascension, setAscension] = useState(0);
  const [adding, setAdding] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleChampionSearchChange = useCallback((val: string) => {
    setChampionSearch(val);
    setSelectedChampion(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchChampions(val, 10);
        setSearchResults(res.champions);
      } catch {
        // ignore search errors
      }
    }, 300);
  }, []);

  const handleSelectChampion = useCallback((c: Champion) => {
    setSelectedChampion(c);
    setChampionSearch(c.name);
    setSearchResults([]);
  }, []);

  const reset = useCallback(() => {
    setSelectedChampion(null);
    setChampionSearch('');
    setSearchResults([]);
    setIsPreferredAttacker(false);
    setAscension(0);
  }, []);

  const prefillFromEntry = useCallback((entry: RosterEntry) => {
    const champion: Champion = {
      id: entry.champion_id,
      name: entry.champion_name,
      champion_class: entry.champion_class,
      image_url: entry.image_url,
      is_7_star: entry.rarity.startsWith('7'),
      is_ascendable: entry.is_ascendable ?? false,
      alias: null,
    };
    setSelectedChampion(champion);
    setChampionSearch(entry.champion_name);
    setSelectedRarity(entry.rarity);
    setSignatureValue(entry.signature);
    setAscension(entry.ascension ?? 0);
  }, []);

  const handleSubmit = useCallback(async (): Promise<RosterEntry[] | null> => {
    if (!selectedAccountId || !selectedChampion) return null;
    setAdding(true);
    try {
      await updateChampionInRoster(
        selectedAccountId,
        selectedChampion.id,
        selectedRarity,
        signatureValue,
        isPreferredAttacker,
        ascension
      );
      const updated = await getRoster(selectedAccountId);
      toast.success(t.roster.addSuccess.replace('{name}', selectedChampion.name));
      reset();
      setTimeout(() => searchInputRef.current?.focus(), 50);
      return updated;
    } catch (e: unknown) {
      toast.error((e as Error).message || t.roster.errors.addError);
      return null;
    } finally {
      setAdding(false);
    }
  }, [
    selectedAccountId,
    selectedChampion,
    selectedRarity,
    signatureValue,
    isPreferredAttacker,
    ascension,
    reset,
    t,
  ]);

  return {
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
  };
}
