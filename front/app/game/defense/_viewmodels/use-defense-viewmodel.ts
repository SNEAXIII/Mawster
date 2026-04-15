'use client';

import { useEffect } from 'react';
import { useAllianceRole } from '@/hooks/use-alliance-role';
import { useAllianceSelector } from '@/hooks/use-alliance-selector';
import { useDefenseActions } from '../_hooks/use-defense-actions';

interface UseDefenseViewModelOptions {
  onStateChange?: (allianceId: string, bg: number) => void;
  initialAllianceId?: string;
  initialBg?: number;
}

export function useDefenseViewModel({
  onStateChange,
  initialAllianceId,
  initialBg,
}: UseDefenseViewModelOptions = {}) {
  const { canManage, isOwner } = useAllianceRole();

  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
  } = useAllianceSelector({ initialAllianceId, initialBg });

  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId);
  const userCanManage = selectedAlliance
    ? canManage(selectedAlliance) || isOwner(selectedAlliance)
    : false;

  const defenseActions = useDefenseActions(selectedAllianceId, selectedBg, selectedAlliance?.tag);

  useEffect(() => {
    if (alliances.length > 0 && !selectedAllianceId) {
      const firstId = alliances[0].id;
      setSelectedAllianceId(firstId);
      onStateChange?.(firstId, selectedBg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alliances]);

  const handleNodeClick = (nodeNumber: number) => {
    if (!userCanManage) return;
    defenseActions.setSelectorNode(nodeNumber);
  };

  const handleBgChange = (bg: number) => {
    setSelectedBg(bg);
    if (selectedAllianceId) onStateChange?.(selectedAllianceId, bg);
  };

  const handleAllianceChange = (allianceId: string) => {
    setSelectedAllianceId(allianceId);
    setSelectedBg(1);
    onStateChange?.(allianceId, 1);
  };

  return {
    alliances,
    selectedAllianceId,
    selectedBg,
    loading,
    userCanManage,
    defenseActions,
    handleNodeClick,
    handleBgChange,
    handleAllianceChange,
  };
}
