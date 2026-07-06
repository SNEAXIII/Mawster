'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { ClassBadge } from '@/components/class-badge';
import { ActionIconButton } from '@/components/action-icon-button';
import { Champion, getChampionImageUrl } from '@/app/services/champions';
import { useI18n } from '@/app/i18n';

interface ChampionTableRowProps {
  champion: Champion;
  isEditing: boolean;
  editingAlias: string;
  savingAlias: boolean;
  onStartEdit: (champion: Champion) => void;
  onCancelEdit: () => void;
  onSaveAlias: (championId: string) => void;
  onAliasChange: (value: string) => void;
  onDelete: (champion: Champion) => void;
  onToggleAscendable: (champion: Champion) => void;
  onTogglePrefight: (champion: Champion) => void;
  onToggleSagaAttacker: (champion: Champion) => void;
  onToggleSagaDefender: (champion: Champion) => void;
  sagaAttacker: boolean;
  sagaDefender: boolean;
  sagaDisabled?: boolean;
}

export default function ChampionTableRow({
  champion,
  isEditing,
  editingAlias,
  savingAlias,
  onStartEdit,
  onCancelEdit,
  onSaveAlias,
  onAliasChange,
  onDelete,
  onToggleAscendable,
  onTogglePrefight,
  onToggleSagaAttacker,
  onToggleSagaDefender,
  sagaAttacker,
  sagaDefender,
  sagaDisabled,
}: Readonly<ChampionTableRowProps>) {
  const { t } = useI18n();
  return (
    <tr
      className='border-b hover:bg-accent/50'
      data-cy={`champion-row-${champion.name}`}
    >
      {/* Image */}
      <td className='p-3'>
        {champion.image_url ? (
          <img
            src={getChampionImageUrl(champion.image_url, 40) ?? ''}
            alt={champion.name}
            className='size-10 rounded object-cover'
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className='size-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground'>
            ?
          </div>
        )}
      </td>

      {/* Name */}
      <td className='p-3 font-medium'>{champion.name}</td>

      {/* Class */}
      <td className='p-3'>
        <ClassBadge championClass={champion.champion_class} />
      </td>

      {/* Alias */}
      <td className='p-3'>
        {isEditing ? (
          <div className='flex items-center gap-1'>
            <Input
              value={editingAlias}
              onChange={(e) => onAliasChange(e.target.value)}
              placeholder='alias1;alias2;alias3'
              className='h-8 text-sm'
              disabled={savingAlias}
              data-cy='alias-input'
            />
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onSaveAlias(champion.id)}
              disabled={savingAlias}
              data-cy='save-alias'
            >
              <Check className='text-primary size-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={onCancelEdit}
              disabled={savingAlias}
              data-cy='cancel-alias'
            >
              <X className='text-destructive size-4' />
            </Button>
          </div>
        ) : (
          <span className='text-muted-foreground text-xs'>{champion.alias || '-'}</span>
        )}
      </td>

      {/* Ascendable */}
      <td className='p-3'>
        <button
          onClick={() => onToggleAscendable(champion)}
          data-cy={`toggle-ascendable-${champion.name}`}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            champion.is_ascendable
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {champion.is_ascendable ? t.common.yes : t.common.no}
        </button>
      </td>

      {/* Pre-fight */}
      <td className='p-3'>
        <button
          onClick={() => onTogglePrefight(champion)}
          data-cy={`toggle-prefight-${champion.name}`}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
            champion.has_prefight
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {champion.has_prefight ? t.common.yes : t.common.no}
        </button>
      </td>

      {/* Saga Attacker */}
      <td className='p-3'>
        <button
          onClick={() => onToggleSagaAttacker(champion)}
          disabled={sagaDisabled}
          data-cy={`toggle-saga-attacker-${champion.name}`}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            sagaAttacker
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {sagaAttacker ? t.common.yes : t.common.no}
        </button>
      </td>

      {/* Saga Defender */}
      <td className='p-3'>
        <button
          onClick={() => onToggleSagaDefender(champion)}
          disabled={sagaDisabled}
          data-cy={`toggle-saga-defender-${champion.name}`}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            sagaDefender
              ? 'bg-primary/10 text-primary hover:bg-primary/20'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {sagaDefender ? t.common.yes : t.common.no}
        </button>
      </td>

      {/* Actions */}
      <td className='p-3'>
        <div className='flex items-center gap-1'>
          <ActionIconButton
            icon={<Pencil className='size-3.5' />}
            onClick={() => onStartEdit(champion)}
            title='Edit alias'
            data-cy={`edit-alias-${champion.name}`}
          />
          <ActionIconButton
            icon={<Trash2 />}
            onClick={() => onDelete(champion)}
            variant='danger'
            data-cy={`delete-champion-${champion.name}`}
          />
        </div>
      </td>
    </tr>
  );
}
