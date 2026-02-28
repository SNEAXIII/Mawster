'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import { useRequiredSession } from '@/hooks/use-required-session';
import { AllianceRoleProvider, useAllianceRole } from '@/hooks/use-alliance-role';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { Shield, Trash2 } from 'lucide-react';

import {
  type Alliance,
  type GameAccount,
  getMyAlliances,
  getMyGameAccounts,
} from '@/app/services/game';
import {
  type DefensePlacement,
  type DefenseSummary,
  type AvailableChampion,
  type ChampionOwner,
  type BgMember,
  getDefense,
  placeDefender,
  removeDefender,
  clearDefense,
  getAvailableChampions,
  getBgMembers,
} from '@/app/services/defense';

import WarMap from './_components/war-map';
import ChampionSelector from './_components/champion-selector';
import DefenseSidePanel from './_components/defense-side-panel';

function DefensePageContent() {
  const { t } = useI18n();
  const { status } = useRequiredSession();
  const { canManage, isOwner, myAccountIds } = useAllianceRole();

  // State
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [myAccounts, setMyAccounts] = useState<GameAccount[]>([]);
  const [selectedAllianceId, setSelectedAllianceId] = useState<string>('');
  const [selectedBg, setSelectedBg] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [defenseLoading, setDefenseLoading] = useState(false);

  // Defense data
  const [defenseSummary, setDefenseSummary] = useState<DefenseSummary | null>(null);
  const [availableChampions, setAvailableChampions] = useState<AvailableChampion[]>([]);
  const [bgMembers, setBgMembers] = useState<BgMember[]>([]);

  // Dialogs
  const [selectorNode, setSelectorNode] = useState<number | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
  const userCanManage = selectedAlliance ? (canManage(selectedAlliance) || isOwner(selectedAlliance)) : false;

  // ─── Data fetching ─────────────────────────────────────
  const fetchAlliances = useCallback(async () => {
    try {
      const data = await getMyAlliances();
      setAlliances(data);
      if (data.length > 0 && !selectedAllianceId) {
        setSelectedAllianceId(data[0].id);
      }
    } catch (err: any) {
      toast.error(t.game.defense.loadError);
    }
  }, [t, selectedAllianceId]);

  const fetchMyAccounts = useCallback(async () => {
    try {
      const data = await getMyGameAccounts();
      setMyAccounts(data);
    } catch {
      // silent
    }
  }, []);

  const fetchDefense = useCallback(async () => {
    if (!selectedAllianceId) return;
    setDefenseLoading(true);
    try {
      const [defense, champions, members] = await Promise.all([
        getDefense(selectedAllianceId, selectedBg),
        getAvailableChampions(selectedAllianceId, selectedBg),
        getBgMembers(selectedAllianceId, selectedBg),
      ]);
      setDefenseSummary(defense);
      setAvailableChampions(champions);
      setBgMembers(members);
    } catch (err: any) {
      toast.error(t.game.defense.loadError);
    } finally {
      setDefenseLoading(false);
    }
  }, [selectedAllianceId, selectedBg, t]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    Promise.all([fetchAlliances(), fetchMyAccounts()]).finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    if (selectedAllianceId) {
      fetchDefense();
    }
  }, [selectedAllianceId, selectedBg, fetchDefense]);

  // ─── Actions ───────────────────────────────────────────
  const handleNodeClick = (nodeNumber: number) => {
    if (!userCanManage) return;
    setSelectorNode(nodeNumber);
  };

  const handlePlaceDefender = async (
    championUserId: string,
    gameAccountId: string,
    championName: string,
  ) => {
    if (!selectedAllianceId || selectorNode === null) return;
    try {
      const placement = await placeDefender(
        selectedAllianceId,
        selectedBg,
        selectorNode,
        championUserId,
        gameAccountId,
      );
      toast.success(
        t.game.defense.placeSuccess.replace('{name}', championName).replace('{node}', String(selectorNode)),
      );

      // Update state locally instead of refetching everything
      setDefenseSummary((prev) => {
        if (!prev) return prev;
        // Remove any existing placement on the same node, then add the new one
        const filtered = prev.placements.filter((p) => p.node_number !== selectorNode);
        return {
          ...prev,
          placements: [...filtered, placement],
        };
      });

      // Remove the placed champion from available list (or update owners)
      setAvailableChampions((prev) =>
        prev
          .map((champ) => {
            if (champ.champion_id !== placement.champion_user_id.split('/')[0]) {
              // Try matching by champion name + owner
              const ownerIdx = champ.owners.findIndex(
                (o) => o.champion_user_id === championUserId && o.game_account_id === gameAccountId,
              );
              if (ownerIdx === -1) return champ;
              // Remove this owner from available
              const newOwners = champ.owners.filter((_, i) => i !== ownerIdx);
              if (newOwners.length === 0) return null; // Remove entirely
              return { ...champ, owners: newOwners };
            }
            return champ;
          })
          .filter(Boolean) as AvailableChampion[],
      );

      // Update BG member defender counts
      setBgMembers((prev) =>
        prev.map((m) =>
          m.game_account_id === gameAccountId
            ? { ...m, defender_count: m.defender_count + 1 }
            : m,
        ),
      );

      setSelectorNode(null);
    } catch (err: any) {
      toast.error(err.message || t.game.defense.placeError);
    }
  };

  const handleRemoveDefender = async (nodeNumber: number) => {
    if (!selectedAllianceId) return;

    // Capture the placement before removing (for local state update)
    const removedPlacement = defenseSummary?.placements.find(
      (p) => p.node_number === nodeNumber,
    );

    try {
      await removeDefender(selectedAllianceId, selectedBg, nodeNumber);
      toast.success(t.game.defense.removeSuccess);

      // Update state locally instead of refetching everything
      if (removedPlacement) {
        setDefenseSummary((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            placements: prev.placements.filter((p) => p.node_number !== nodeNumber),
          };
        });

        // Re-add the champion back to available list
        setAvailableChampions((prev) => {
          const restoredOwner: ChampionOwner = {
            champion_user_id: removedPlacement.champion_user_id,
            game_account_id: removedPlacement.game_account_id,
            game_pseudo: removedPlacement.game_pseudo,
            rarity: removedPlacement.rarity,
            stars: parseInt(removedPlacement.rarity.replace(/[^\d]/g, '')) || 0,
            rank: 0,
            signature: removedPlacement.signature,
            defender_count: Math.max(
              0,
              (bgMembers.find((m) => m.game_account_id === removedPlacement.game_account_id)
                ?.defender_count ?? 1) - 1,
            ),
            is_preferred_attacker: removedPlacement.is_preferred_attacker,
          };

          const existing = prev.find(
            (c) => c.champion_name === removedPlacement.champion_name && c.champion_class === removedPlacement.champion_class,
          );
          if (existing) {
            return prev.map((c) =>
              c === existing
                ? { ...c, owners: [...c.owners, restoredOwner] }
                : c,
            );
          }
          // Champion was completely removed before, re-add it
          return [
            ...prev,
            {
              champion_id: removedPlacement.champion_user_id,
              champion_name: removedPlacement.champion_name,
              champion_class: removedPlacement.champion_class,
              image_url: removedPlacement.champion_image_url,
              owners: [restoredOwner],
            },
          ];
        });

        // Update BG member defender counts
        setBgMembers((prevMembers) =>
          prevMembers.map((m) =>
            m.game_account_id === removedPlacement.game_account_id
              ? { ...m, defender_count: Math.max(0, m.defender_count - 1) }
              : m,
          ),
        );
      }
    } catch (err: any) {
      toast.error(err.message || t.game.defense.removeError);
    }
  };

  const handleClearDefense = async () => {
    if (!selectedAllianceId) return;
    try {
      await clearDefense(selectedAllianceId, selectedBg);
      toast.success(t.game.defense.clearSuccess);
      await fetchDefense();
    } catch (err: any) {
      toast.error(err.message || t.game.defense.clearError);
    }
    setClearConfirmOpen(false);
  };

  const handleBgChange = (bg: string) => {
    setSelectedBg(parseInt(bg));
  };

  const handleAllianceChange = (allianceId: string) => {
    setSelectedAllianceId(allianceId);
    setSelectedBg(1);
  };

  // ─── Render ────────────────────────────────────────────
  if (loading || status === 'loading') return <FullPageSpinner />;

  if (alliances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">{t.game.defense.title}</h2>
        <p className="text-muted-foreground">{t.game.defense.noAlliance}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold">{t.game.defense.title}</h1>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Alliance selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">
                {t.game.defense.alliance}:
              </label>
              <Select value={selectedAllianceId} onValueChange={handleAllianceChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {alliances.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      [{a.tag}] {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* BG selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium whitespace-nowrap">
                {t.game.defense.battlegroup}:
              </label>
              <div className="flex gap-1">
                {[1, 2, 3].map((bg) => (
                  <Button
                    key={bg}
                    variant={selectedBg === bg ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleBgChange(String(bg))}
                  >
                    BG {bg}
                  </Button>
                ))}
              </div>
            </div>

            {/* Clear button */}
            {userCanManage && defenseSummary && defenseSummary.placements.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="ml-auto"
                onClick={() => setClearConfirmOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t.game.defense.clearAll}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main content */}
      {defenseLoading ? (
        <FullPageSpinner />
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* War Map */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardContent className="p-2 sm:p-4">
                <WarMap
                  placements={defenseSummary?.placements ?? []}
                  onNodeClick={handleNodeClick}
                  onRemove={handleRemoveDefender}
                  canManage={userCanManage}
                />
              </CardContent>
            </Card>
          </div>

          {/* Side panel */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0">
            <Card>
              <CardContent className="p-3">
                <DefenseSidePanel
                  members={bgMembers}
                  placements={defenseSummary?.placements ?? []}
                  onRemoveDefender={handleRemoveDefender}
                  canManage={userCanManage}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Champion selector dialog */}
      {selectorNode !== null && (
        <ChampionSelector
          open={selectorNode !== null}
          onClose={() => setSelectorNode(null)}
          nodeNumber={selectorNode}
          availableChampions={availableChampions}
          onSelect={handlePlaceDefender}
        />
      )}

      {/* Clear confirmation */}
      <ConfirmationDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t.game.defense.clearConfirmTitle}
        description={t.game.defense.clearConfirmDesc}
        confirmText={t.common.confirm}
        onConfirm={handleClearDefense}
        variant="destructive"
      />
    </div>
  );
}

export default function DefensePage() {
  return (
    <AllianceRoleProvider>
      <DefensePageContent />
    </AllianceRoleProvider>
  );
}
