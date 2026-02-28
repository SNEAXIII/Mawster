'use client';

import React from 'react';
import { useI18n } from '@/app/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { type DefensePlacement, type BgMember } from '@/app/services/defense';
import { cn } from '@/app/lib/utils';
import ChampionPortrait from '@/components/champion-portrait';
import { X } from 'lucide-react';

interface DefenseSidePanelProps {
  members: BgMember[];
  placements: DefensePlacement[];
  onRemoveDefender: (nodeNumber: number) => void;
  canManage: boolean;
}

export default function DefenseSidePanel({
  members,
  placements,
  onRemoveDefender,
  canManage,
}: DefenseSidePanelProps) {
  const { t } = useI18n();

  // Group placements by game_account_id
  const placementsByPlayer = new Map<string, DefensePlacement[]>();
  for (const p of placements) {
    const key = p.game_account_id;
    if (!placementsByPlayer.has(key)) {
      placementsByPlayer.set(key, []);
    }
    placementsByPlayer.get(key)!.push(p);
  }

  // Sort placements by node_number per player
  for (const [, pList] of placementsByPlayer) {
    pList.sort((a, b) => a.node_number - b.node_number);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        {t.game.defense.membersTitle}
      </h3>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.game.defense.noMembers}</p>
      ) : (
        members.map((member) => {
          const playerPlacements = placementsByPlayer.get(member.game_account_id) ?? [];
          const isFull = member.defender_count >= member.max_defenders;
          return (
            <Card key={member.game_account_id} className="bg-card/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{member.game_pseudo}</span>
                  <span
                    className={cn(
                      'text-xs font-mono',
                      isFull ? 'text-red-400' : 'text-muted-foreground',
                    )}
                  >
                    {member.defender_count}/{member.max_defenders}
                  </span>
                </div>
                {playerPlacements.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {playerPlacements.map((p) => (
                      <div
                        key={p.id}
                        className="relative group flex flex-col items-center"
                        title={`Node #${p.node_number} — ${p.champion_name}`}
                      >
                        <ChampionPortrait
                          imageUrl={p.champion_image_url}
                          name={p.champion_name}
                          rarity={p.rarity}
                          size={40}
                        />
                        <span className={cn(
                          'text-[9px]',
                          p.is_preferred_attacker ? 'text-yellow-400 font-semibold' : 'text-muted-foreground',
                        )}>
                          {p.is_preferred_attacker && '⚔ '}#{p.node_number}
                        </span>
                        {canManage && (
                          <button
                            className="absolute -top-1 -right-1 z-10 hidden group-hover:flex bg-red-600 hover:bg-red-700 text-white rounded-full w-4 h-4 items-center justify-center"
                            onClick={() => onRemoveDefender(p.node_number)}
                            title={t.game.defense.removeDefender}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    {t.game.defense.noDefendersPlaced}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
