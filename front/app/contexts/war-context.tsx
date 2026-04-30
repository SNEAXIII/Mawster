'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useI18n } from '@/app/i18n';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { toast } from 'sonner';
import {
  type War,
  type WarPlacement,
  type WarDefenseSummary,
  type AvailableAttacker,
  type WarSynergy,
  type WarPrefight,
  getCurrentWar,
  createWar,
  endWar,
  getWarDefense,
  placeWarDefender,
  removeWarDefender,
  clearWarBg,
  assignWarAttacker,
  removeWarAttacker,
  updateWarKo,
  getWarSynergies,
  addWarSynergy,
  removeWarSynergy,
  getWarPrefights,
  addWarPrefight,
  removeWarPrefight,
  toggleCombatCompleted,
} from '@/app/services/war';
import { WarMode } from '@/app/game/war/_components/war-types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Alliance = ReturnType<typeof useAllianceSelector>['alliances'][number];

interface WarContextValue {
  // Alliance selection
  alliances: Alliance[];
  selectedAllianceId: string;
  setSelectedAllianceId: (id: string) => void;
  selectedBg: number;
  setSelectedBg: (bg: number) => void;
  loading: boolean;
  canManageWar: boolean;
  isMine: (gameAccountId: string) => boolean;

  // War
  currentWar: War | null;
  activeWarId: string;
  managementLoading: boolean;
  warLoading: boolean;
  placements: WarPlacement[];

  // Mode
  warMode: WarMode;
  setWarMode: (mode: WarMode) => void;

  // UI state
  selectorNode: number | null;
  setSelectorNode: (node: number | null) => void;
  attackerSelectorNode: number | null;
  setAttackerSelectorNode: (node: number | null) => void;
  showClearConfirm: boolean;
  setShowClearConfirm: (show: boolean) => void;
  showCreateDialog: boolean;
  setShowCreateDialog: (show: boolean) => void;
  showEndConfirm: boolean;
  setShowEndConfirm: (show: boolean) => void;
  pendingRemoveNode: number | null;
  setPendingRemoveNode: (node: number | null) => void;

  // Actions
  handleNodeClick: (node: number) => void;
  handleCreateWar: (opponentName: string, bannedChampionIds: string[]) => Promise<void>;
  handleEndWar: (win: boolean, eloChange: number | null) => Promise<void>;
  refreshAlliances: () => Promise<void>;
  handlePlaceDefender: (
    championId: string,
    championName: string,
    stars: number,
    rank: number,
    ascension: number
  ) => Promise<void>;
  handleRemoveDefender: (node: number) => void;
  handleConfirmRemoveDefender: () => Promise<void>;
  handleClearBg: () => Promise<void>;
  handleAssignAttacker: (attacker: AvailableAttacker) => Promise<void>;
  handleRemoveAttacker: (node: number) => Promise<void>;
  handleUpdateKo: (node: number, newKo: number) => Promise<void>;

  // Synergy
  synergies: WarSynergy[];
  handleAddSynergy: (championUserId: string, targetChampionUserId: string) => Promise<void>;
  handleRemoveSynergy: (championUserId: string) => Promise<void>;

  // Prefight
  prefights: WarPrefight[];
  handleAddPrefight: (championUserId: string, targetNodeNumber: number) => Promise<void>;
  handleRemovePrefight: (championUserId: string) => Promise<void>;

  // Combat completion
  handleToggleCombatCompleted: (nodeNumber: number) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WarContext = createContext<WarContextValue | null>(null);

export function useWar(): WarContextValue {
  const ctx = useContext(WarContext);
  if (!ctx) throw new Error('useWar must be used inside <WarProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WarProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { t } = useI18n();
  const { canManage, isMine } = useAllianceRole();

  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
    refresh,
  } = useAllianceSelector();

  // ─── War state ─────────────────────────────────────────────────────────────
  const [currentWar, setCurrentWar] = useState<War | null>(null);
  const [managementLoading, setManagementLoading] = useState(false);
  const [warMode, setWarMode] = useState<WarMode>(WarMode.Attackers);

  // ─── Dialog / selector state ───────────────────────────────────────────────
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // ─── Defense state ─────────────────────────────────────────────────────────
  const [warSummary, setWarSummary] = useState<WarDefenseSummary | null>(null);
  const [synergies, setSynergies] = useState<WarSynergy[]>([]);
  const [prefights, setPrefights] = useState<WarPrefight[]>([]);
  const [warLoading, setWarLoading] = useState(false);
  const [selectorNode, setSelectorNode] = useState<number | null>(null);
  const [attackerSelectorNode, setAttackerSelectorNode] = useState<number | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingRemoveNode, setPendingRemoveNode] = useState<number | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // ─── Derived values ────────────────────────────────────────────────────────
  const activeWarId = currentWar?.id ?? '';
  const placements = useMemo<WarPlacement[]>(() => warSummary?.placements ?? [], [warSummary]);
  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
  const canManageWar = selectedAlliance ? canManage(selectedAlliance) : false;

  // ─── Auto-select first alliance ────────────────────────────────────────────
  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      setSelectedAllianceId(alliances[0].id);
    }
  }, [alliances, selectedAllianceId, setSelectedAllianceId]);

  // ─── Fetch current war ─────────────────────────────────────────────────────
  const fetchCurrentWar = useCallback(async () => {
    if (!selectedAllianceId) return;
    setManagementLoading(true);
    try {
      const war = await getCurrentWar(selectedAllianceId);
      setCurrentWar(war);
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 404) {
        setCurrentWar(null);
      } else {
        toast.error(tRef.current.game.war.loadError);
      }
    } finally {
      setManagementLoading(false);
    }
  }, [selectedAllianceId]);

  useEffect(() => {
    setCurrentWar(null);
    fetchCurrentWar();
  }, [selectedAllianceId, fetchCurrentWar]);

  // ─── Fetch war defense ─────────────────────────────────────────────────────
  const fetchWarDefense = useCallback(
    async (silent = false) => {
      if (!selectedAllianceId || !activeWarId) return;
      if (!silent) setWarLoading(true);
      try {
        const [summary, synergyList, prefightList] = await Promise.all([
          getWarDefense(selectedAllianceId, activeWarId, selectedBg),
          getWarSynergies(selectedAllianceId, activeWarId, selectedBg),
          getWarPrefights(selectedAllianceId, activeWarId, selectedBg),
        ]);
        setWarSummary(summary);
        setSynergies(synergyList);
        setPrefights(prefightList);
      } catch {
        if (!silent) toast.error(tRef.current.game.war.loadError);
      } finally {
        if (!silent) setWarLoading(false);
      }
    },
    [selectedAllianceId, activeWarId, selectedBg]
  );

  useEffect(() => {
    setWarSummary(null);
    if (activeWarId) fetchWarDefense();
  }, [activeWarId, selectedBg, fetchWarDefense]);

  // Polling every 10s
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (activeWarId) {
      pollRef.current = setInterval(() => fetchWarDefense(true), 10_000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchWarDefense, activeWarId]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback(
    (nodeNumber: number) => {
      if (!activeWarId) return;
      switch (warMode) {
        case WarMode.Attackers: {
          const hasDefender = placements.some((p) => p.node_number === nodeNumber);
          if (!hasDefender) {
            toast.warning(t.game.war.defenderRequired);
            return;
          }
          setAttackerSelectorNode(nodeNumber);
          break;
        }
        case WarMode.Defenders:
          if (!selectedAlliance || !canManage(selectedAlliance)) return;
          setSelectorNode(nodeNumber);
          break;
        case WarMode.Plan:
          break;
      }
    },
    [activeWarId, warMode, placements, t, selectedAlliance, canManage]
  );

  const handleCreateWar = async (opponentName: string, bannedChampionIds: string[]) => {
    try {
      const war = await createWar(selectedAllianceId, opponentName, bannedChampionIds);
      toast.success(t.game.war.createSuccess.replace('{name}', opponentName));
      setCurrentWar(war);
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.createError);
      throw err;
    }
  };

  const handleEndWar = async (win: boolean, eloChange: number | null) => {
    if (!currentWar) return;
    try {
      await endWar(selectedAllianceId, currentWar.id, win, eloChange);
      await refresh();
      toast.success(t.game.war.endWarSuccess);
      setCurrentWar(null);
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.endWarError);
    }
  };

  const handlePlaceDefender = async (
    championId: string,
    championName: string,
    stars: number,
    rank: number,
    ascension: number
  ) => {
    if (!selectedAllianceId || !activeWarId || selectorNode === null) return;
    const node = selectorNode;
    try {
      const placement = await placeWarDefender(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        node,
        championId,
        stars,
        rank,
        ascension
      );
      toast.success(
        t.game.war.placeSuccess.replace('{name}', championName).replace('{node}', String(node))
      );
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: [...prev.placements.filter((p) => p.node_number !== node), placement],
            }
          : prev
      );
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.placeError);
    }
  };

  const doRemoveDefender = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      await removeWarDefender(selectedAllianceId, activeWarId, selectedBg, nodeNumber);
      toast.success(t.game.war.removeSuccess);
      setWarSummary((prev) =>
        prev
          ? { ...prev, placements: prev.placements.filter((p) => p.node_number !== nodeNumber) }
          : prev
      );
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.removeError);
    }
  };

  const handleRemoveDefender = (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    const placement = warSummary?.placements.find((p) => p.node_number === nodeNumber);
    if (placement?.attacker_champion_user_id) {
      setPendingRemoveNode(nodeNumber);
      return;
    }
    void doRemoveDefender(nodeNumber);
  };

  const handleConfirmRemoveDefender = async () => {
    if (pendingRemoveNode === null) return;
    const node = pendingRemoveNode;
    setPendingRemoveNode(null);
    await doRemoveDefender(node);
  };

  const handleClearBg = async () => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      await clearWarBg(selectedAllianceId, activeWarId, selectedBg);
      toast.success(t.game.war.clearSuccess);
      setWarSummary((prev) => (prev ? { ...prev, placements: [] } : prev));
    } catch {
      toast.error(t.game.war.loadError);
    }
  };

  const handleAssignAttacker = async (attacker: AvailableAttacker) => {
    if (!selectedAllianceId || !activeWarId || attackerSelectorNode === null) return;
    const nodeNumber = attackerSelectorNode;
    try {
      await assignWarAttacker(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        nodeNumber,
        attacker.champion_user_id
      );
      toast.success(
        t.game.war.assignSuccess
          .replace('{name}', attacker.champion_name)
          .replace('{node}', String(nodeNumber))
      );
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === nodeNumber
                  ? {
                      ...p,
                      attacker_champion_user_id: attacker.champion_user_id,
                      attacker_pseudo: attacker.game_pseudo,
                      attacker_champion_name: attacker.champion_name,
                      attacker_champion_class: attacker.champion_class,
                      attacker_image_url: attacker.image_url,
                      attacker_rarity: attacker.rarity,
                      attacker_is_preferred_attacker: attacker.is_preferred_attacker,
                      attacker_ascension: attacker.ascension,
                      attacker_is_saga_attacker: attacker.is_saga_attacker,
                      attacker_is_saga_defender: attacker.is_saga_defender,
                    }
                  : p
              ),
            }
          : prev
      );
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.assignError);
    }
  };

  const handleRemoveAttacker = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      const updated = await removeWarAttacker(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        nodeNumber
      );
      toast.success(t.game.war.removeAttackerSuccess);
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === updated.node_number ? updated : p
              ),
            }
          : prev
      );
      const updatedSynergies = await getWarSynergies(selectedAllianceId, activeWarId, selectedBg);
      setSynergies(updatedSynergies);
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.removeAttackerError);
    }
  };

  const handleUpdateKo = async (nodeNumber: number, newKo: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      const updated = await updateWarKo(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        nodeNumber,
        newKo
      );
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === updated.node_number ? updated : p
              ),
            }
          : prev
      );
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.loadError);
    }
  };

  const handleAddSynergy = async (championUserId: string, targetChampionUserId: string) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      const synergy = await addWarSynergy(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        championUserId,
        targetChampionUserId
      );
      toast.success(
        t.game.war.synergy.addSuccess.replace('{target}', synergy.target_champion_name)
      );
      setSynergies((prev) => [...prev, synergy]);
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.synergy.addError);
    }
  };

  const handleRemoveSynergy = async (championUserId: string) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      await removeWarSynergy(selectedAllianceId, activeWarId, selectedBg, championUserId);
      toast.success(t.game.war.synergy.removeSuccess);
      setSynergies((prev) => prev.filter((s) => s.champion_user_id !== championUserId));
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.synergy.removeError);
    }
  };

  const handleAddPrefight = async (championUserId: string, targetNodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      const prefight = await addWarPrefight(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        championUserId,
        targetNodeNumber
      );
      toast.success(
        t.game.war.prefight.addSuccess.replace('#{node}', String(prefight.target_node_number))
      );
      setPrefights((prev) => [...prev, prefight]);
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.prefight.addError);
    }
  };

  const handleRemovePrefight = async (championUserId: string) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      await removeWarPrefight(selectedAllianceId, activeWarId, selectedBg, championUserId);
      toast.success(t.game.war.prefight.removeSuccess);
      setPrefights((prev) => prev.filter((p) => p.champion_user_id !== championUserId));
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.prefight.removeError);
    }
  };

  const handleToggleCombatCompleted = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return;
    try {
      const updated = await toggleCombatCompleted(
        selectedAllianceId,
        activeWarId,
        selectedBg,
        nodeNumber
      );
      setWarSummary((prev) =>
        prev
          ? {
              ...prev,
              placements: prev.placements.map((p) =>
                p.node_number === updated.node_number ? updated : p
              ),
            }
          : prev
      );
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.markCombatError);
    }
  };

  // ─── Context value ─────────────────────────────────────────────────────────

  const value = useMemo<WarContextValue>(
    () => ({
      alliances,
      selectedAllianceId,
      setSelectedAllianceId,
      selectedBg,
      setSelectedBg,
      loading,
      canManageWar,
      isMine,
      currentWar,
      activeWarId,
      managementLoading,
      warLoading,
      placements,
      warMode,
      setWarMode,
      selectorNode,
      setSelectorNode,
      attackerSelectorNode,
      setAttackerSelectorNode,
      showClearConfirm,
      setShowClearConfirm,
      showCreateDialog,
      setShowCreateDialog,
      showEndConfirm,
      setShowEndConfirm,
      pendingRemoveNode,
      setPendingRemoveNode,
      handleNodeClick,
      handleCreateWar,
      handleEndWar,
      refreshAlliances: refresh,
      handlePlaceDefender,
      handleRemoveDefender,
      handleConfirmRemoveDefender,
      handleClearBg,
      handleAssignAttacker,
      handleRemoveAttacker,
      handleUpdateKo,
      synergies,
      handleAddSynergy,
      handleRemoveSynergy,
      prefights,
      handleAddPrefight,
      handleRemovePrefight,
      handleToggleCombatCompleted,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      alliances,
      selectedAllianceId,
      selectedBg,
      loading,
      canManageWar,
      currentWar,
      activeWarId,
      managementLoading,
      warLoading,
      placements,
      warMode,
      selectorNode,
      attackerSelectorNode,
      showClearConfirm,
      showCreateDialog,
      showEndConfirm,
      pendingRemoveNode,
      handleNodeClick,
      synergies,
      prefights,
    ]
  );

  return <WarContext.Provider value={value}>{children}</WarContext.Provider>;
}
