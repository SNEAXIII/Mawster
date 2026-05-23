'use client';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ChampionFilterSelect from './champion-filter-select';
import type { Season, AccessibleAlliance } from '@/app/services/fight-records';

interface Filters {
  champion_id: string | null;
  defender_champion_id: string | null;
  node_number: string;
  tier: string;
  game_account_pseudo: string;
}

interface Props {
  filters: Filters;
  planningErrorOnly: boolean | null;
  seasonSelector: string;
  seasonId: string | null;
  seasons: Season[];
  onChange: (key: keyof Filters, value: string | null) => void;
  onTogglePlanningError: () => void;
  onSeasonSelectorChange: (value: string) => void;
  onSeasonIdChange: (value: string | null) => void;
  allianceId: string | null;
  accessibleAlliances: AccessibleAlliance[];
  onAllianceChange: (value: string | null) => void;
  onClear: () => void;
}

export default function KnowledgeBaseFilters({
  filters, planningErrorOnly, seasonSelector, seasonId, seasons,
  allianceId, accessibleAlliances,
  onChange, onTogglePlanningError, onSeasonSelectorChange, onSeasonIdChange, onAllianceChange, onClear,
}: Props) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  return (
    <div className='flex flex-wrap gap-2 items-center'>
      <ChampionFilterSelect
        value={filters.champion_id}
        onChange={(id) => onChange('champion_id', id)}
        placeholder={kb.filterAttacker}
        data-cy='filter-attacker'
      />
      <ChampionFilterSelect
        value={filters.defender_champion_id}
        onChange={(id) => onChange('defender_champion_id', id)}
        placeholder={kb.filterDefender}
        data-cy='filter-defender'
      />
      <Input
        className='w-24'
        type='number'
        min={1}
        placeholder={kb.filterNode}
        value={filters.node_number}
        onChange={(e) => onChange('node_number', e.target.value)}
        data-cy='filter-node'
      />
      <Input
        className='w-24'
        type='number'
        min={1}
        placeholder={kb.filterTier}
        value={filters.tier}
        onChange={(e) => onChange('tier', e.target.value)}
        data-cy='filter-tier'
      />
      <Input
        className='w-36'
        type='text'
        placeholder={kb.filterPlayer}
        value={filters.game_account_pseudo}
        onChange={(e) => onChange('game_account_pseudo', e.target.value)}
        data-cy='filter-player'
      />

      <Select
        value={seasonSelector}
        onValueChange={onSeasonSelectorChange}
        data-cy='filter-season-selector'
      >
        <SelectTrigger className='w-44' data-cy='filter-season-selector-trigger'>
          <SelectValue placeholder={kb.filterSeason} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>{kb.seasonSelectorAll}</SelectItem>
          <SelectItem value='all_seasons'>{kb.seasonSelectorAllSeasons}</SelectItem>
          <SelectItem value='current'>{kb.seasonSelectorCurrent}</SelectItem>
          <SelectItem value='off_season'>{kb.seasonSelectorOffSeason}</SelectItem>
          <SelectItem value='specific'>{kb.seasonSelectorSpecific}</SelectItem>
        </SelectContent>
      </Select>

      {seasonSelector === 'specific' && seasons.length > 0 && (
        <Select
          value={seasonId ?? ''}
          onValueChange={(v) => onSeasonIdChange(v || null)}
          data-cy='filter-season-id'
        >
          <SelectTrigger className='w-36' data-cy='filter-season-id-trigger'>
            <SelectValue placeholder={kb.filterSeason} />
          </SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {kb.seasonLabel.replace('{number}', String(s.number))}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {accessibleAlliances.length > 1 && (
        <Select
          value={allianceId ?? 'all'}
          onValueChange={(v) => onAllianceChange(v === 'all' ? null : v)}
          data-cy='filter-alliance'
        >
          <SelectTrigger className='w-44' data-cy='filter-alliance-trigger'>
            <SelectValue placeholder={kb.filterAlliance} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{kb.allAlliances}</SelectItem>
            {accessibleAlliances.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                [{a.tag}] {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Button
        variant={planningErrorOnly ? 'default' : 'outline'}
        onClick={onTogglePlanningError}
        data-cy='filter-planning-error'
        className='flex items-center gap-1'
      >
        <AlertTriangle className='h-3.5 w-3.5' />
        {kb.filterPlanningError}
      </Button>
      <Button variant='outline' onClick={onClear} data-cy='filter-clear'>
        {kb.clearFilters}
      </Button>
    </div>
  );
}
