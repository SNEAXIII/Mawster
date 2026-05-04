'use client';
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

interface Filters {
  champion_id: string | null;
  defender_champion_id: string | null;
  node_number: string;
  tier: string;
  game_account_pseudo: string;
}

interface Props {
  filters: Filters;
  onChange: (key: keyof Filters, value: string | null) => void;
  onClear: () => void;
}

export default function KnowledgeBaseFilters({ filters, onChange, onClear }: Props) {
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
        onChange={(e) => onChange('node_number', e.target.value || null)}
        data-cy='filter-node'
      />
      <Input
        className='w-24'
        type='number'
        min={1}
        placeholder={kb.filterTier}
        value={filters.tier}
        onChange={(e) => onChange('tier', e.target.value || null)}
        data-cy='filter-tier'
      />
      <Input
        className='w-36'
        type='text'
        placeholder={kb.filterPlayer}
        value={filters.game_account_pseudo}
        onChange={(e) => onChange('game_account_pseudo', e.target.value || null)}
        data-cy='filter-player'
      />
      <Button variant='outline' onClick={onClear} data-cy='filter-clear'>
        {kb.clearFilters}
      </Button>
    </div>
  );
}
