'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { toast } from 'sonner';
import { type War, getCurrentWar, createWar, endWar } from '@/app/services/war';

export function useCurrentWar(allianceId: string) {
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const [currentWar, setCurrentWar] = useState<War | null>(null);
  const [warLoading, setWarLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const fetchCurrentWar = useCallback(async (id: string) => {
    if (!id) return;
    setWarLoading(true);
    try {
      const war = await getCurrentWar(id);
      setCurrentWar(war);
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 404) {
        setCurrentWar(null);
      } else {
        toast.error(tRef.current.game.war.loadError);
      }
    } finally {
      setWarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allianceId) fetchCurrentWar(allianceId);
  }, [allianceId, fetchCurrentWar]);

  const handleCreateWar = async (opponentName: string) => {
    if (!allianceId) return;
    try {
      const war = await createWar(allianceId, opponentName);
      toast.success(tRef.current.game.war.createSuccess.replace('{name}', opponentName));
      setCurrentWar(war);
    } catch (err: unknown) {
      toast.error((err as Error).message || tRef.current.game.war.createError);
      throw err;
    }
  };

  const handleEndWar = async () => {
    if (!allianceId || !currentWar) return;
    try {
      await endWar(allianceId, currentWar.id);
      toast.success(tRef.current.game.war.endWarSuccess);
      setCurrentWar(null);
    } catch (err: unknown) {
      toast.error((err as Error).message || tRef.current.game.war.endWarError);
    }
  };

  return {
    currentWar,
    warLoading,
    showCreateDialog,
    setShowCreateDialog,
    showEndConfirm,
    setShowEndConfirm,
    handleCreateWar,
    handleEndWar,
  };
}
