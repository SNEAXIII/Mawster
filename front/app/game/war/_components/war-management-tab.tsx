'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Swords, Flag } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import type { War } from '@/app/services/war';

interface WarManagementTabProps {
  wars: War[];
  selectedWarId: string | null;
  onWarChange: (id: string) => void;
  canManageWar: boolean;
  hasActiveWar: boolean;
  selectedWar: War | undefined;
  onOpenCreateDialog: () => void;
  onOpenEndWarConfirm: () => void;
}

export default function WarManagementTab({
  wars,
  selectedWarId,
  onWarChange,
  canManageWar,
  hasActiveWar,
  selectedWar,
  onOpenCreateDialog,
  onOpenEndWarConfirm,
}: Readonly<WarManagementTabProps>) {
  const { t } = useI18n();

  return (
    <div className='space-y-4'>
      {/* War selector + actions */}
      <div className='flex flex-wrap items-center gap-3'>
        <Select
          value={selectedWarId ?? undefined}
          onValueChange={onWarChange}
        >
          <SelectTrigger
            className='w-56'
            data-cy='war-select'
          >
            <SelectValue placeholder={t.game.war.selectWar} />
          </SelectTrigger>
          <SelectContent>
            {wars.map((w) => (
              <SelectItem
                key={w.id}
                value={w.id}
                data-cy={`war-option-${w.id}`}
              >
                vs {w.opponent_name}
                {w.status === 'ended' ? ' ✓' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canManageWar && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant='default'
                    onClick={onOpenCreateDialog}
                    disabled={hasActiveWar}
                    data-cy='declare-war-btn'
                  >
                    <Swords className='w-4 h-4 mr-2' />
                    {t.game.war.declareWar}
                  </Button>
                </span>
              </TooltipTrigger>
              {hasActiveWar && (
                <TooltipContent>{t.game.war.declareWarTooltip}</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        )}

        {canManageWar && selectedWar?.status === 'active' && (
          <Button
            variant='destructive'
            onClick={onOpenEndWarConfirm}
            data-cy='end-war-btn'
          >
            <Flag className='w-4 h-4 mr-2' />
            {t.game.war.endWar}
          </Button>
        )}
      </div>

      {wars.length === 0 && <p className='text-muted-foreground'>{t.game.war.noWar}</p>}

      {selectedWar && (
        <div className='text-sm text-muted-foreground'>
          vs{' '}
          <span className='font-semibold text-foreground'>{selectedWar.opponent_name}</span>
        </div>
      )}
    </div>
  );
}
