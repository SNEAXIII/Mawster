'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { RosterEntry, RARITY_LABELS, UpgradeRequest } from '@/app/services/roster';
import RosterChampionCard from './roster-champion-card';

interface RosterGridProps {
  groupedRoster: [string, RosterEntry[]][];
  onEdit?: (entry: RosterEntry) => void;
  onDelete?: (entry: RosterEntry) => void;
  onUpgrade?: (entry: RosterEntry) => void;
  readOnly?: boolean;
  /** Pending upgrade requests — used to show cancel button instead of upgrade arrow */
  upgradeRequests?: UpgradeRequest[];
  /** Callback to cancel an upgrade request */
  onCancelRequest?: (requestId: string) => void;
}

export default function RosterGrid({
  groupedRoster,
  onEdit,
  onDelete,
  onUpgrade,
  readOnly = false,
  upgradeRequests,
  onCancelRequest,
}: RosterGridProps) {
  const { t } = useI18n();

  if (groupedRoster.length === 0) {
    return <p className="text-gray-500">{t.roster.empty}</p>;
  }

  return (
    <div className="space-y-6">
      {groupedRoster.map(([rarity, entries]) => (
        <div key={rarity}>
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <span className="bg-gray-800 text-yellow-400 px-3 py-0.5 rounded-md text-sm font-bold">
              {RARITY_LABELS[rarity]}
            </span>
            <span className="text-sm text-gray-400">({entries.length})</span>
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
            {entries.map((entry) => {
              const pending = upgradeRequests?.find((r) => r.champion_user_id === entry.id);
              return (
                <RosterChampionCard
                  key={entry.id}
                  entry={entry}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onUpgrade={onUpgrade}
                  readOnly={readOnly}
                  pendingRequestId={pending?.id}
                  onCancelRequest={onCancelRequest}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
