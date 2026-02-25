'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import ChampionPortrait from '@/components/champion-portrait';
import {
  RosterEntry,
  getClassColors,
  shortenChampionName,
  getNextRarity,
} from '@/app/services/roster';
import { FiTrash2, FiEdit2, FiArrowUp, FiX } from 'react-icons/fi';

interface RosterChampionCardProps {
  entry: RosterEntry;
  onEdit?: (entry: RosterEntry) => void;
  onDelete?: (entry: RosterEntry) => void;
  onUpgrade?: (entry: RosterEntry) => void;
  readOnly?: boolean;
  /** If set, this champion has a pending upgrade request */
  pendingRequestId?: string;
  /** Callback to cancel a pending upgrade request */
  onCancelRequest?: (requestId: string) => void;
}

export default function RosterChampionCard({
  entry,
  onEdit,
  onDelete,
  onUpgrade,
  readOnly = false,
  pendingRequestId,
  onCancelRequest,
}: RosterChampionCardProps) {
  const { t } = useI18n();
  const classColors = getClassColors(entry.champion_class);
  const nextRarity = getNextRarity(entry.rarity);

  return (
    <div
      className={`rounded-md bg-gray-900 ${classColors.border} border-[3px] shadow hover:shadow-lg transition-shadow relative group overflow-hidden`}
    >
      {/* Action buttons — visible on hover */}
      {!readOnly && (
        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          {pendingRequestId && onCancelRequest ? (
            <button
              className="text-red-400 hover:text-red-300 bg-black/60 rounded-full p-1"
              onClick={() => onCancelRequest(pendingRequestId)}
              title={t.roster.upgradeRequests.cancel}
            >
              <FiX size={14} />
            </button>
          ) : nextRarity && onUpgrade ? (
            <button
              className="text-green-400 hover:text-green-300 bg-black/60 rounded-full p-1"
              onClick={() => onUpgrade(entry)}
              title={t.roster.upgrade}
            >
              <FiArrowUp size={14} />
            </button>
          ) : null}
          {onEdit && (
            <button
              className="text-blue-400 hover:text-blue-300 bg-black/60 rounded-full p-1"
              onClick={() => onEdit(entry)}
              title="Edit"
            >
              <FiEdit2 size={14} />
            </button>
          )}
          {onDelete && (
            <button
              className="text-red-400 hover:text-red-600 bg-black/60 rounded-full p-1"
              onClick={() => onDelete(entry)}
              title={t.common.delete}
            >
              <FiTrash2 size={14} />
            </button>
          )}
        </div>
      )}

      {/* Champion portrait with frame */}
      <div className="flex justify-center pt-1">
        <ChampionPortrait
          imageUrl={entry.image_url}
          name={entry.champion_name}
          rarity={entry.rarity}
          size={72}
        />
      </div>

      {/* Name (shortened) */}
      <p
        className="text-[10px] font-semibold text-white text-center truncate px-0.5 mt-0.5"
        title={entry.champion_name}
      >
        {shortenChampionName(entry.champion_name)}
      </p>

      {/* Signature */}
      <div className="flex justify-center pb-1">
        {entry.signature > 0 ? (
          <span className="text-amber-400 text-[9px] font-semibold">
            sig {entry.signature}
          </span>
        ) : (
          <span className="text-white/50 text-[9px]">sig 0</span>
        )}
      </div>
    </div>
  );
}
