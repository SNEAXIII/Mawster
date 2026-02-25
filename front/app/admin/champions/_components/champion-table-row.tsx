'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FiCheck, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
import { ClassBadge } from '@/components/class-badge';
import { ActionIconButton } from '@/components/action-icon-button';
import { Champion, getChampionImageUrl } from '@/app/services/champions';

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
}: ChampionTableRowProps) {
  console.log('Rendering ChampionTableRow for', champion.name);
  console.log('isEditing:', isEditing, 'editingAlias:', editingAlias, 'savingAlias:', savingAlias);
  console.log('Champion data:', champion.image_url, champion.champion_class, champion.alias);
  return (
    <tr className="border-b hover:bg-gray-50">
      {/* Image */}
      <td className="p-3">
        {champion.image_url ? (
          <img
            src={getChampionImageUrl(champion.image_url, 40) ?? ''}
            alt={champion.name}
            className="w-10 h-10 rounded object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-xs text-gray-500">
            ?
          </div>
        )}
      </td>

      {/* Name */}
      <td className="p-3 font-medium">{champion.name}</td>

      {/* Class */}
      <td className="p-3">
        <ClassBadge championClass={champion.champion_class} />
      </td>

      {/* Alias */}
      <td className="p-3">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editingAlias}
              onChange={(e) => onAliasChange(e.target.value)}
              placeholder="alias1;alias2;alias3"
              className="h-8 text-sm"
              disabled={savingAlias}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSaveAlias(champion.id)}
              disabled={savingAlias}
            >
              <FiCheck className="text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              disabled={savingAlias}
            >
              <FiX className="text-red-600" />
            </Button>
          </div>
        ) : (
          <span className="text-gray-600 text-xs">{champion.alias || '-'}</span>
        )}
      </td>

      {/* Actions */}
      <td className="p-3">
        <div className="flex items-center gap-1">
          <ActionIconButton
            icon={<FiEdit2 className="w-3.5 h-3.5" />}
            onClick={() => onStartEdit(champion)}
            title="Edit alias"
          />
          <ActionIconButton
            icon={<FiTrash2 />}
            onClick={() => onDelete(champion)}
            variant="danger"
          />
        </div>
      </td>
    </tr>
  );
}
