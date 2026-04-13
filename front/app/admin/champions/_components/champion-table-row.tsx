'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Flame, Pencil, Trash2, X } from 'lucide-react';
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
}: ChampionTableRowProps) {
  const { t } = useI18n();
  return (
    <tr className='border-b hover:bg-accent/50'>
      {/* Image */}
      <td className='p-3'>
        {champion.image_url ? (
          <img
            src={getChampionImageUrl(champion.image_url, 40) ?? ''}
            alt={champion.name}
            className='w-10 h-10 rounded object-cover'
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className='w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground'>
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
            />
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onSaveAlias(champion.id)}
              disabled={savingAlias}
            >
              <Check className='text-green-600 h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={onCancelEdit}
              disabled={savingAlias}
            >
              <X className='text-red-600 h-4 w-4' />
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
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            champion.is_ascendable
              ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          {champion.is_ascendable ? t.common.yes : t.common.no}
        </button>
      </td>

      {/* Pre-fight */}
      <td className='p-3'>
        <button
          onClick={() => onTogglePrefight(champion)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
            champion.has_prefight
              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          <Flame className='h-3 w-3' />
          {champion.has_prefight ? t.common.yes : t.common.no}
        </button>
      </td>

      {/* Saga Attacker */}
      <td className='p-3'>
        <button
          onClick={() => onToggleSagaAttacker(champion)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            champion.is_saga_attacker
              ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          {champion.is_saga_attacker ? t.common.yes : t.common.no}
        </button>
      </td>

      {/* Saga Defender */}
      <td className='p-3'>
        <button
          onClick={() => onToggleSagaDefender(champion)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            champion.is_saga_defender
              ? 'bg-green-100 text-green-700 hover:bg-green-200'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          {champion.is_saga_defender ? t.common.yes : t.common.no}
        </button>
      </td>

      {/* Actions */}
      <td className='p-3'>
        <div className='flex items-center gap-1'>
          <ActionIconButton
            icon={<Pencil className='w-3.5 h-3.5' />}
            onClick={() => onStartEdit(champion)}
            title='Edit alias'
          />
          <ActionIconButton
            icon={<Trash2 />}
            onClick={() => onDelete(champion)}
            variant='danger'
          />
        </div>
      </td>
    </tr>
  );
}
