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
import { cn } from '@/app/lib/utils';
import { RARITY_LABELS } from '@/app/services/roster';
import {
  RosterFilters,
  RANK_OPTIONS,
  ASCENSION_OPTIONS,
  isFilterActive,
} from './roster-filters';
import FilterToggleGroup from './filter-toggle-group';

interface RosterFilterBarProps {
  filters: RosterFilters;
  onChange: (patch: Partial<RosterFilters>) => void;
  onReset: () => void;
  availableClasses: string[];
  filteredCount: number;
  totalCount: number;
}

export default function RosterFilterBar({
  filters,
  onChange,
  onReset,
  availableClasses,
  filteredCount,
  totalCount,
}: Readonly<RosterFilterBarProps>) {
  const { t } = useI18n();
  const f = t.roster.filter;

  const boolToggle = (
    key: 'sagaAttacker' | 'sagaDefender' | 'preferredAttacker' | 'awakened',
    label: string,
    cy: string
  ) => (
    <Button
      type='button'
      variant='outline'
      size='sm'
      data-cy={cy}
      className={cn('h-8 text-xs', filters[key] && 'bg-primary/10 border-primary text-primary')}
      onClick={() => onChange({ [key]: !filters[key] })}
    >
      {label}
    </Button>
  );

  return (
    <div className='mb-4 space-y-2'>
      <div className='flex flex-wrap items-center gap-3'>
        {/* Left: name + class */}
        <Input
          value={filters.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder={f.namePlaceholder}
          className='h-8 w-44 text-xs'
          data-cy='roster-filter-name'
        />
        {availableClasses.length > 0 && (
          <Select
            value={filters.championClass || 'all'}
            onValueChange={(val) => onChange({ championClass: val === 'all' ? '' : val })}
          >
            <SelectTrigger
              className='h-8 w-32 text-xs'
              data-cy='roster-filter-class'
            >
              <SelectValue placeholder={f.classLabel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{f.allClasses}</SelectItem>
              {availableClasses.map((c) => (
                <SelectItem
                  key={c}
                  value={c}
                >
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Center: rank + ascension */}
        <FilterToggleGroup
          options={RANK_OPTIONS}
          selected={filters.ranks}
          onChange={(ranks) => onChange({ ranks })}
          labelFor={(r) => RARITY_LABELS[r] ?? r}
          cyPrefix='roster-filter-rank'
        />
        <FilterToggleGroup
          options={ASCENSION_OPTIONS}
          selected={filters.ascensions}
          onChange={(ascensions) => onChange({ ascensions })}
          labelFor={(a) => `${f.ascension} ${a}`}
          cyPrefix='roster-filter-asc'
        />

        {/* Right: toggles + min sig + reset */}
        {boolToggle('sagaAttacker', f.sagaAttacker, 'roster-filter-saga-attacker')}
        {boolToggle('sagaDefender', f.sagaDefender, 'roster-filter-saga-defender')}
        {boolToggle('preferredAttacker', f.preferred, 'roster-filter-preferred')}
        {boolToggle('awakened', f.awakened, 'roster-filter-awakened')}
        <Input
          type='number'
          min={0}
          max={200}
          value={filters.minSignature}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ minSignature: Number.isNaN(n) ? 0 : Math.min(200, Math.max(0, n)) });
          }}
          className='h-8 w-20 text-xs'
          placeholder={f.minSignature}
          data-cy='roster-filter-min-sig'
        />
        {isFilterActive(filters) && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8 text-xs text-muted-foreground'
            data-cy='roster-filter-reset'
            onClick={onReset}
          >
            {f.reset}
          </Button>
        )}
      </div>
      <p
        className='text-xs text-muted-foreground'
        data-cy='roster-filter-count'
      >
        {f.count
          .replace('{filtered}', String(filteredCount))
          .replace('{total}', String(totalCount))}
      </p>
    </div>
  );
}
