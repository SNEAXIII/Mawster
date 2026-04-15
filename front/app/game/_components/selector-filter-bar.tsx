'use client';

import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/app/lib/utils';

export interface ToggleConfig {
  key: string;
  label: string;
  active: boolean;
  onToggle: (v: boolean) => void;
}

interface SelectorFilterBarProps {
  classes: string[];
  classFilter: string;
  onClassChange: (v: string) => void;
  players?: string[];
  playerFilter?: string;
  onPlayerChange?: (v: string) => void;
  toggles: ToggleConfig[];
  canReset: boolean;
  onReset: () => void;
}

export default function SelectorFilterBar({
  classes,
  classFilter,
  onClassChange,
  players,
  playerFilter,
  onPlayerChange,
  toggles = [],
  canReset,
  onReset,
}: Readonly<SelectorFilterBarProps>) {
  const { t } = useI18n();

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {players && players.length > 0 && onPlayerChange && (
        <Select
          value={playerFilter || 'all'}
          onValueChange={(val) => onPlayerChange(val === 'all' ? '' : val)}
        >
          <SelectTrigger className='h-8 w-36 text-xs' data-cy='selector-player-filter'>
            <SelectValue placeholder={t.game.defense.playerFilter} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t.game.defense.playerFilter}</SelectItem>
            {players.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {classes.length > 0 && (
        <Select
          value={classFilter || 'all'}
          onValueChange={(val) => onClassChange(val === 'all' ? '' : val)}
        >
          <SelectTrigger className='h-8 w-36 text-xs' data-cy='selector-class-filter'>
            <SelectValue placeholder={t.roster.selectClass} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t.roster.classFilter}</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {toggles.map((toggle) => (
        <Button
          key={toggle.key}
          variant='outline'
          size='sm'
          data-cy={`selector-toggle-${toggle.key}`}
          className={cn(
            'h-8 text-xs',
            toggle.active && 'bg-primary/10 border-primary text-primary'
          )}
          onClick={() => toggle.onToggle(!toggle.active)}
        >
          {toggle.label}
        </Button>
      ))}

      {canReset && (
        <Button
          variant='ghost'
          size='sm'
          data-cy='selector-reset-filters'
          className='h-8 text-xs text-muted-foreground'
          onClick={onReset}
        >
          {t.dashboard.pagination.resetFilters}
        </Button>
      )}
    </div>
  );
}
