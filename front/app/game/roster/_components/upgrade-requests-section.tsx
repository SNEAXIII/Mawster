'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import { CollapsibleSection } from '@/components/collapsible-section';
import ChampionPortrait from '@/components/champion-portrait';
import {
  getUpgradeRequests,
  cancelUpgradeRequest,
  UpgradeRequest,
  RARITY_LABELS,
  getClassColors,
} from '@/app/services/roster';
import { FiX } from 'react-icons/fi';

interface UpgradeRequestsSectionProps {
  gameAccountId: string | null;
  /** Key to trigger refresh (e.g. after roster changes) */
  refreshKey?: number;
  /** Whether the current user can cancel requests (officer/owner) */
  canCancel?: boolean;
  /** External requests — when provided, skip internal fetch */
  externalRequests?: UpgradeRequest[];
  /** Callback when a request is cancelled externally */
  onRequestCancelled?: (requestId: string) => void;
}

export default function UpgradeRequestsSection({
  gameAccountId,
  refreshKey = 0,
  canCancel = true,
  externalRequests,
  onRequestCancelled,
}: UpgradeRequestsSectionProps) {
  const { t } = useI18n();
  const [internalRequests, setInternalRequests] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const requests = externalRequests ?? internalRequests;

  useEffect(() => {
    // Skip fetch if using external requests
    if (externalRequests !== undefined) return;
    if (!gameAccountId) {
      setInternalRequests([]);
      return;
    }
    setLoading(true);
    getUpgradeRequests(gameAccountId)
      .then(setInternalRequests)
      .catch(() => {/* silent */})
      .finally(() => setLoading(false));
  }, [gameAccountId, refreshKey, externalRequests]);

  const handleCancel = async (requestId: string) => {
    try {
      await cancelUpgradeRequest(requestId);
      if (onRequestCancelled) {
        onRequestCancelled(requestId);
      } else {
        setInternalRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
      toast.success(t.roster.upgradeRequests.cancelSuccess);
    } catch {
      toast.error(t.roster.upgradeRequests.cancelError);
    }
  };

  // Don't render at all if no requests
  if (!gameAccountId || (!loading && requests.length === 0)) return null;

  return (
    <CollapsibleSection
      title={`${t.roster.upgradeRequests.title} (${requests.length})`}
      defaultOpen={false}
      className="mb-4"
    >
      {loading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => {
            const classColors = getClassColors(req.champion_class);
            return (
              <div
                key={req.id}
                className={`flex items-center gap-3 p-2 rounded-md bg-gray-900 ${classColors.border} border`}
              >
                <ChampionPortrait
                  imageUrl={req.image_url}
                  name={req.champion_name}
                  rarity={req.current_rarity}
                  size={40}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {req.champion_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">
                      {t.roster.upgradeRequests.currentRarity.replace(
                        '{rarity}',
                        RARITY_LABELS[req.current_rarity] ?? req.current_rarity,
                      )}
                    </span>
                    <span className="text-yellow-400 font-semibold">
                      → {RARITY_LABELS[req.requested_rarity] ?? req.requested_rarity}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500">
                    {t.roster.upgradeRequests.requestedBy.replace('{pseudo}', req.requester_pseudo)}
                  </p>
                </div>
                {canCancel && (
                  <button
                    className="text-red-400 hover:text-red-300 bg-black/40 rounded-full p-1 shrink-0"
                    onClick={() => handleCancel(req.id)}
                    title={t.roster.upgradeRequests.cancel}
                  >
                    <FiX size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
