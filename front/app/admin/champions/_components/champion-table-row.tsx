'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FiCheck, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';
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
}: ChampionTableRowProps) {
  const { t } = useI18n();
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

      {/* Ascendable */}
      <td className="p-3">
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
