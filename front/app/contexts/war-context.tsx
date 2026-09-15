'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAllianceSelector } from '@/hooks/use-alliance-selector'
import { useI18n } from '@/app/i18n'
import { useVisiblePoll } from '@/hooks/use-visible-poll'
import { useAllianceRole } from '@/hooks/use-alliance-role'
import { toast } from 'sonner'
import {
  type War,
  type WarPlacement,
  type WarBoosts,
  type WarDefenseSummary,
  type WarProgress,
  type AvailableAttacker,
  type WarSynergy,
  type WarPrefight,
  createWar,
  updateWar,
  endWar,
  getWarDefense,
  placeWarDefender,
  removeWarDefender,
  clearWarBg,
  assignWarAttacker,
  removeWarAttacker,
  updateWarKo,
  updateWarBoosts,
  MAX_KO_COUNT,
  getWarSynergies,
  addWarSynergy,
  removeWarSynergy,
  getWarPrefights,
  addWarPrefight,
  removeWarPrefight,
  toggleCombatCompleted,
  toggleFightNotDone,
  togglePlanningError,
  assignWarAssist,
  removeWarAssist,
  getAvailableAttackers,
  getAvailablePrefightAttackers,
} from '@/app/services/war'
import { upsertWarFightNote, deleteWarFightNote } from '@/app/services/war-notes'
import { reportNote } from '@/app/services/moderation'
import { WarMode } from '@/app/game/war/_components/war-types'
import { useWarSelection } from './use-war-selection'

// ─── Types ────────────────────────────────────────────────────────────────────

type Alliance = ReturnType<typeof useAllianceSelector>['alliances'][number]

interface WarContextValue {
  // Alliance selection
  alliances: Alliance[]
  selectedAllianceId: string
  setSelectedAllianceId: (id: string) => void
  handleAllianceChange: (allianceId: string) => void
  selectedBg: number
  setSelectedBg: (bg: number) => void
  handleBgChange: (bg: number) => void
  loading: boolean
  canManageWar: boolean
  canPlaceWar: boolean
  isVisitor: boolean
  isMine: (gameAccountId: string) => boolean

  // War — `currentWar` is the War on screen, running or closed
  wars: War[]
  selectedWarId: string | null
  setSelectedWarId: (id: string) => void
  hasActiveWar: boolean
  isWarClosed: boolean
  isMapReadOnly: boolean
  currentWar: War | null
  activeWarId: string
  managementLoading: boolean
  warLoading: boolean
  placements: WarPlacement[]
  progress: WarProgress | null

  // Mode
  warMode: WarMode
  setWarMode: (mode: WarMode) => void

  // UI state
  selectorNode: number | null
  setSelectorNode: (node: number | null) => void
  attackerSelectorNode: number | null
  setAttackerSelectorNode: (node: number | null) => void
  showClearConfirm: boolean
  setShowClearConfirm: (show: boolean) => void
  showCreateDialog: boolean
  setShowCreateDialog: (show: boolean) => void
  showEndConfirm: boolean
  setShowEndConfirm: (show: boolean) => void
  pendingRemoveNode: number | null
  setPendingRemoveNode: (node: number | null) => void

  // Actions
  handleNodeClick: (node: number) => void
  handleCreateWar: (opponentName: string, bannedChampionIds: string[]) => Promise<void>
  handleEditWar: (opponentName: string, bannedChampionIds: string[]) => Promise<void>
  handleEndWar: (
    win: boolean,
    eloChange: number | null,
    opponentDeaths: number | null
  ) => Promise<void>
  refreshAlliances: () => Promise<void>
  handlePlaceDefender: (
    championId: string,
    championName: string,
    stars: number,
    rank: number,
    ascension: number
  ) => Promise<void>
  handleRemoveDefender: (node: number) => void
  handleConfirmRemoveDefender: () => Promise<void>
  handleClearBg: () => Promise<void>
  handleAssignAttacker: (attacker: AvailableAttacker) => Promise<void>
  handleRemoveAttacker: (node: number) => Promise<void>
  handleAdjustKo: (node: number, delta: number) => void
  handleUpdateBoosts: (nodeNumber: number, boosts: WarBoosts) => Promise<void>
  loadAvailableAttackers: (
    gameAccountId?: string,
    nodeNumber?: number
  ) => Promise<AvailableAttacker[]>
  loadAvailablePrefightAttackers: () => Promise<AvailableAttacker[]>

  // Synergy
  synergies: WarSynergy[]
  handleAddSynergy: (championUserId: string, targetChampionUserId: string) => Promise<void>
  handleRemoveSynergy: (championUserId: string) => Promise<void>

  // Prefight
  prefights: WarPrefight[]
  handleAddPrefight: (championUserId: string, targetNodeNumber: number) => Promise<void>
  handleRemovePrefight: (championUserId: string, targetNodeNumber: number) => Promise<void>

  // Combat completion
  handleToggleCombatCompleted: (nodeNumber: number) => Promise<void>
  handleToggleFightNotDone: (nodeNumber: number) => Promise<void>
  handleTogglePlanningError: (nodeNumber: number) => Promise<void>

  // Assist
  handleAssignAssist: (nodeNumber: number, championUserId: string) => Promise<void>
  handleRemoveAssist: (nodeNumber: number) => Promise<void>

  // Fight note
  handleSaveNote: (nodeNumber: number, content: string) => Promise<void>
  handleDeleteNote: (nodeNumber: number) => Promise<void>
  handleReportNote: (noteId: string) => Promise<boolean>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WarContext = createContext<WarContextValue | null>(null)

export function useWar(): WarContextValue {
  const ctx = useContext(WarContext)
  if (!ctx) throw new Error('useWar must be used inside <WarProvider>')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const KO_FLUSH_DELAY_MS = 400

export function WarProvider({
  children,
  onStateChange,
  initialAllianceId,
  initialBg,
}: Readonly<{
  children: ReactNode
  onStateChange?: (allianceId: string, bg: number) => void
  initialAllianceId?: string
  initialBg?: number
}>) {
  const { t } = useI18n()
  const { canManage, canPlace, isMine } = useAllianceRole()

  const {
    alliances,
    selectedAllianceId,
    setSelectedAllianceId,
    selectedBg,
    setSelectedBg,
    loading,
    refresh,
  } = useAllianceSelector({ initialAllianceId, initialBg })

  // ─── War state ─────────────────────────────────────────────────────────────
  const {
    wars,
    selectedWarId,
    setSelectedWarId,
    currentWar,
    hasActiveWar,
    loading: managementLoading,
    fetchWars,
    showWar,
  } = useWarSelection(selectedAllianceId)
  const [warMode, setWarMode] = useState<WarMode>(WarMode.Attackers)

  // ─── Dialog / selector state ───────────────────────────────────────────────
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  // ─── Defense state ─────────────────────────────────────────────────────────
  const [warSummary, setWarSummary] = useState<WarDefenseSummary | null>(null)
  const [synergies, setSynergies] = useState<WarSynergy[]>([])
  const [prefights, setPrefights] = useState<WarPrefight[]>([])
  const [warLoading, setWarLoading] = useState(false)
  const [selectorNode, setSelectorNode] = useState<number | null>(null)
  const [attackerSelectorNode, setAttackerSelectorNode] = useState<number | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [pendingRemoveNode, setPendingRemoveNode] = useState<number | null>(null)

  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  // Bumped before and after every write: a fetch that overlapped one drops its snapshot.
  const writeSeq = useRef(0)
  const write = async <T,>(call: () => Promise<T>): Promise<T> => {
    writeSeq.current += 1
    try {
      return await call()
    } finally {
      writeSeq.current += 1
    }
  }

  // ─── Derived values ────────────────────────────────────────────────────────
  const activeWarId = currentWar?.id ?? ''
  const placements = useMemo<WarPlacement[]>(() => warSummary?.placements ?? [], [warSummary])

  // The battlegroup on screen is recounted from the placements we hold, so a KO
  // or a completed fight moves the counter right away instead of at the next
  // poll; the other two keep the server's numbers.
  const progress = useMemo<WarProgress | null>(() => {
    const served = warSummary?.progress
    if (!served) return null
    const live = placements.reduce(
      (acc, p) => ({
        completed: acc.completed + (p.is_combat_completed || p.is_fight_not_done ? 1 : 0),
        ko_count: acc.ko_count + p.ko_count,
      }),
      { completed: 0, ko_count: 0 }
    )
    const battlegroups = served.battlegroups.map((bg) =>
      bg.battlegroup === warSummary.battlegroup ? { ...bg, ...live } : bg
    )
    return {
      total: served.total,
      completed: battlegroups.reduce((n, bg) => n + bg.completed, 0),
      ko_count: battlegroups.reduce((n, bg) => n + bg.ko_count, 0),
      battlegroups,
    }
  }, [warSummary, placements])
  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId)
  const canManageWar = selectedAlliance ? canManage(selectedAlliance) : false
  const canPlaceWar = selectedAlliance ? canPlace(selectedAlliance) : false
  const isVisitor = useMemo(
    () => alliances.find((a) => a.id === selectedAllianceId)?.isVisitor ?? false,
    [alliances, selectedAllianceId]
  )
  const isWarClosed = currentWar?.status === 'ended'
  const isMapReadOnly = isVisitor || (isWarClosed && !canPlaceWar)

  const handleAllianceChange = useCallback(
    (allianceId: string) => {
      setSelectedAllianceId(allianceId)
      onStateChange?.(allianceId, selectedBg)
    },
    [setSelectedAllianceId, onStateChange, selectedBg]
  )

  const handleBgChange = useCallback(
    (bg: number) => {
      setSelectedBg(bg)
      if (selectedAllianceId) onStateChange?.(selectedAllianceId, bg)
    },
    [setSelectedBg, onStateChange, selectedAllianceId]
  )

  // Auto-select first alliance when none is selected, or when the selected id
  // (e.g. from a shared link) is not among the user's alliances.
  useEffect(() => {
    if (alliances.length === 0) return
    const exists = alliances.some((a) => a.id === selectedAllianceId)
    if (!selectedAllianceId || !exists) {
      setSelectedAllianceId(alliances[0].id)
      onStateChange?.(alliances[0].id, selectedBg)
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [alliances, selectedAllianceId, setSelectedAllianceId])

  // ─── Fetch war defense ─────────────────────────────────────────────────────
  const fetchWarDefense = useCallback(
    async (silent = false) => {
      if (!selectedAllianceId || !activeWarId) return
      if (!silent) setWarLoading(true)
      const seq = writeSeq.current
      try {
        const [summary, synergyList, prefightList] = await Promise.all([
          getWarDefense(selectedAllianceId, activeWarId, selectedBg),
          getWarSynergies(selectedAllianceId, activeWarId, selectedBg),
          getWarPrefights(selectedAllianceId, activeWarId, selectedBg),
        ])
        if (seq !== writeSeq.current) return
        const pending = koPending.current
        setWarSummary({
          ...summary,
          placements: summary.placements.map((p) =>
            pending[p.node_number] ? { ...p, ko_count: pending[p.node_number].value } : p
          ),
        })
        setSynergies(synergyList)
        setPrefights(prefightList)
      } catch {
        if (!silent) toast.error(tRef.current.game.war.loadError)
      } finally {
        if (!silent) setWarLoading(false)
      }
    },
    [selectedAllianceId, activeWarId, selectedBg]
  )

  useEffect(() => {
    setWarSummary(null)
    if (activeWarId) fetchWarDefense()
  }, [activeWarId, selectedBg, fetchWarDefense])

  // Polling every 10s, on-screen tabs only
  useVisiblePoll(() => void fetchWarDefense(true), 10_000, Boolean(activeWarId))

  const reloadSynergies = async () => {
    if (!selectedAllianceId || !activeWarId) return
    const seq = writeSeq.current
    const list = await getWarSynergies(selectedAllianceId, activeWarId, selectedBg)
    if (seq === writeSeq.current) setSynergies(list)
  }

  const reloadPrefights = async () => {
    if (!selectedAllianceId || !activeWarId) return
    const seq = writeSeq.current
    const list = await getWarPrefights(selectedAllianceId, activeWarId, selectedBg)
    if (seq === writeSeq.current) setPrefights(list)
  }

  const setPlacement = (updated: WarPlacement) =>
    setWarSummary((prev) =>
      prev
        ? {
            ...prev,
            placements: prev.placements.some((p) => p.node_number === updated.node_number)
              ? prev.placements.map((p) => (p.node_number === updated.node_number ? updated : p))
              : [...prev.placements, updated],
          }
        : prev
    )

  const loadAvailableAttackers = useCallback(
    (gameAccountId?: string, nodeNumber?: number) =>
      getAvailableAttackers(selectedAllianceId, activeWarId, selectedBg, gameAccountId, nodeNumber),
    [selectedAllianceId, activeWarId, selectedBg]
  )

  const loadAvailablePrefightAttackers = useCallback(
    () => getAvailablePrefightAttackers(selectedAllianceId, activeWarId, selectedBg),
    [selectedAllianceId, activeWarId, selectedBg]
  )

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback(
    (nodeNumber: number) => {
      if (!activeWarId) return
      const placement = placements.find((p) => p.node_number === nodeNumber)
      if (placement?.is_attacker_locked && warMode !== WarMode.Export) {
        toast.info(t.game.war.attackerLocked)
        return
      }
      switch (warMode) {
        case WarMode.Attackers: {
          if (!placement) {
            toast.warning(t.game.war.defenderRequired)
            return
          }
          // The attacker selector only assigns; on a closed War that needs Strategist+.
          if (isWarClosed && isMapReadOnly) return
          setAttackerSelectorNode(nodeNumber)
          break
        }
        case WarMode.Defenders:
          if (!selectedAlliance || !canPlace(selectedAlliance)) return
          setSelectorNode(nodeNumber)
          break
        case WarMode.Export:
          break
      }
    },
    [activeWarId, warMode, placements, t, selectedAlliance, canPlace, isWarClosed, isMapReadOnly]
  )

  const handleCreateWar = async (opponentName: string, bannedChampionIds: string[]) => {
    try {
      const war = await createWar(selectedAllianceId, opponentName, bannedChampionIds)
      toast.success(t.game.war.createSuccess.replace('{name}', opponentName))
      showWar(war)
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.createError)
      throw err
    }
  }

  const handleEditWar = async (opponentName: string, bannedChampionIds: string[]) => {
    if (!currentWar) return
    try {
      const war = await updateWar(
        selectedAllianceId,
        currentWar.id,
        opponentName,
        bannedChampionIds
      )
      showWar(war)
      toast.success(t.game.war.editWarSuccess)
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.editWarError)
      throw err
    }
  }

  const handleEndWar = async (
    win: boolean,
    eloChange: number | null,
    opponentDeaths: number | null
  ) => {
    if (!currentWar) return
    try {
      await endWar(selectedAllianceId, currentWar.id, win, eloChange, opponentDeaths)
      await Promise.all([refresh(), fetchWars(currentWar.id)])
      toast.success(t.game.war.endWarSuccess)
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.endWarError)
    }
  }

  const handlePlaceDefender = async (
    championId: string,
    championName: string,
    stars: number,
    rank: number,
    ascension: number
  ) => {
    if (!selectedAllianceId || !activeWarId || selectorNode === null) return
    const node = selectorNode
    const replaced = placements.some((p) => p.node_number === node)
    try {
      const placement = await write(() =>
        placeWarDefender(selectedAllianceId, activeWarId, selectedBg, {
          node_number: node,
          champion_id: championId,
          stars,
          rank,
          ascension,
        })
      )
      toast.success(
        t.game.war.placeSuccess.replace('{name}', championName).replace('{node}', String(node))
      )
      setPlacement(placement)
      if (replaced) await Promise.all([reloadSynergies(), reloadPrefights()])
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.placeError)
    }
  }

  const doRemoveDefender = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      await write(() => removeWarDefender(selectedAllianceId, activeWarId, selectedBg, nodeNumber))
      toast.success(t.game.war.removeSuccess)
      await fetchWarDefense(true)
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.removeError)
    }
  }

  const handleRemoveDefender = (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return
    const placement = warSummary?.placements.find((p) => p.node_number === nodeNumber)
    if (placement?.attacker_champion_user_id) {
      setPendingRemoveNode(nodeNumber)
      return
    }
    void doRemoveDefender(nodeNumber)
  }

  const handleConfirmRemoveDefender = async () => {
    if (pendingRemoveNode === null) return
    const node = pendingRemoveNode
    setPendingRemoveNode(null)
    await doRemoveDefender(node)
  }

  const handleClearBg = async () => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      await write(() => clearWarBg(selectedAllianceId, activeWarId, selectedBg))
      toast.success(t.game.war.clearSuccess)
      await fetchWarDefense(true)
    } catch {
      toast.error(t.game.war.loadError)
    }
  }

  const handleAssignAttacker = async (attacker: AvailableAttacker) => {
    if (!selectedAllianceId || !activeWarId || attackerSelectorNode === null) return
    const nodeNumber = attackerSelectorNode
    try {
      const updated = await write(() =>
        assignWarAttacker(
          selectedAllianceId,
          activeWarId,
          selectedBg,
          nodeNumber,
          attacker.champion_user_id
        )
      )
      toast.success(
        t.game.war.assignSuccess
          .replace('{name}', attacker.champion_name)
          .replace('{node}', String(nodeNumber))
      )
      setPlacement(updated)
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.assignError)
    }
  }

  const handleRemoveAttacker = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      const updated = await write(() =>
        removeWarAttacker(selectedAllianceId, activeWarId, selectedBg, nodeNumber)
      )
      toast.success(t.game.war.removeAttackerSuccess)
      setPlacement(updated)
      await Promise.all([reloadSynergies(), reloadPrefights()])
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.removeAttackerError)
    }
  }

  // Nodes whose KO write has not landed yet. The poll must not roll them back,
  // and the next click must count from here rather than from the screen.
  const koPending = useRef<Record<number, { value: number; timer: ReturnType<typeof setTimeout> }>>(
    {}
  )

  useEffect(() => {
    const pending = koPending.current
    return () => Object.values(pending).forEach(({ timer }) => clearTimeout(timer))
  }, [])

  const patchPlacement = (nodeNumber: number, patch: Partial<WarPlacement>) =>
    setWarSummary((prev) =>
      prev
        ? {
            ...prev,
            placements: prev.placements.map((p) =>
              p.node_number === nodeNumber ? { ...p, ...patch } : p
            ),
          }
        : prev
    )

  const handleAdjustKo = (nodeNumber: number, delta: number) => {
    if (!selectedAllianceId || !activeWarId) return

    const pending = koPending.current
    const base =
      pending[nodeNumber]?.value ??
      placements.find((p) => p.node_number === nodeNumber)?.ko_count ??
      0
    const koCount = Math.min(Math.max(base + delta, 0), MAX_KO_COUNT)
    if (koCount === base) return

    patchPlacement(nodeNumber, { ko_count: koCount })
    if (pending[nodeNumber]) clearTimeout(pending[nodeNumber].timer)
    pending[nodeNumber] = {
      value: koCount,
      timer: setTimeout(() => {
        updateWarKo(selectedAllianceId, activeWarId, selectedBg, nodeNumber, koCount)
          .then((updated) => {
            if (pending[nodeNumber]?.value === koCount) delete pending[nodeNumber]
            patchPlacement(nodeNumber, updated)
          })
          .catch((err: unknown) => {
            if (pending[nodeNumber]?.value === koCount) delete pending[nodeNumber]
            toast.error((err as Error).message || t.game.war.loadError)
            void fetchWarDefense(true)
          })
      }, KO_FLUSH_DELAY_MS),
    }
  }

  const handleUpdateBoosts = async (nodeNumber: number, boosts: WarBoosts) => {
    if (!selectedAllianceId || !activeWarId) return
    const previous = placements.find((p) => p.node_number === nodeNumber)
    patchPlacement(nodeNumber, boosts)
    try {
      const updated = await write(() =>
        updateWarBoosts(selectedAllianceId, activeWarId, selectedBg, nodeNumber, boosts)
      )
      setPlacement(updated)
    } catch (err: unknown) {
      if (previous) patchPlacement(nodeNumber, previous)
      toast.error((err as Error).message || t.game.war.boosts.updateError)
    }
  }

  const handleAddSynergy = async (championUserId: string, targetChampionUserId: string) => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      const synergy = await write(() =>
        addWarSynergy(
          selectedAllianceId,
          activeWarId,
          selectedBg,
          championUserId,
          targetChampionUserId
        )
      )
      toast.success(t.game.war.synergy.addSuccess.replace('{target}', synergy.target_champion_name))
      setSynergies((prev) => [
        ...prev.filter((s) => s.champion_user_id !== synergy.champion_user_id),
        synergy,
      ])
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.synergy.addError)
    }
  }

  const handleRemoveSynergy = async (championUserId: string) => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      await write(() =>
        removeWarSynergy(selectedAllianceId, activeWarId, selectedBg, championUserId)
      )
      toast.success(t.game.war.synergy.removeSuccess)
      await reloadSynergies()
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.synergy.removeError)
    }
  }

  const handleAddPrefight = async (championUserId: string, targetNodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      const prefight = await write(() =>
        addWarPrefight(
          selectedAllianceId,
          activeWarId,
          selectedBg,
          championUserId,
          targetNodeNumber
        )
      )
      toast.success(
        t.game.war.prefight.addSuccess.replace('#{node}', String(prefight.target_node_number))
      )
      setPrefights((prev) => [...prev, prefight])
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.prefight.addError)
    }
  }

  const handleRemovePrefight = async (championUserId: string, targetNodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      await write(() =>
        removeWarPrefight(
          selectedAllianceId,
          activeWarId,
          selectedBg,
          championUserId,
          targetNodeNumber
        )
      )
      toast.success(t.game.war.prefight.removeSuccess)
      await reloadPrefights()
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.prefight.removeError)
    }
  }

  const applyPlacementWrite = async (
    call: () => Promise<WarPlacement>,
    errorMessage: string,
    successMessage?: string
  ) => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      const updated = await write(call)
      if (successMessage) toast.success(successMessage)
      setPlacement(updated)
    } catch (err: unknown) {
      toast.error((err as Error).message || errorMessage)
    }
  }

  const handleToggleCombatCompleted = (nodeNumber: number) =>
    applyPlacementWrite(
      () => toggleCombatCompleted(selectedAllianceId, activeWarId, selectedBg, nodeNumber),
      t.game.war.markCombatError
    )

  const handleToggleFightNotDone = (nodeNumber: number) =>
    applyPlacementWrite(
      () => toggleFightNotDone(selectedAllianceId, activeWarId, selectedBg, nodeNumber),
      t.game.war.markCombatError
    )

  const handleTogglePlanningError = (nodeNumber: number) =>
    applyPlacementWrite(
      () => togglePlanningError(selectedAllianceId, activeWarId, selectedBg, nodeNumber),
      t.game.war.markCombatError
    )

  const handleAssignAssist = (nodeNumber: number, championUserId: string) =>
    applyPlacementWrite(
      () =>
        assignWarAssist(selectedAllianceId, activeWarId, selectedBg, nodeNumber, championUserId),
      t.game.war.assist.addError,
      t.game.war.assist.addSuccess
    )

  const handleRemoveAssist = (nodeNumber: number) =>
    applyPlacementWrite(
      () => removeWarAssist(selectedAllianceId, activeWarId, selectedBg, nodeNumber),
      t.game.war.assist.removeError,
      t.game.war.assist.removeSuccess
    )

  const handleSaveNote = async (nodeNumber: number, content: string) => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      const note = await write(() =>
        upsertWarFightNote(selectedAllianceId, activeWarId, selectedBg, nodeNumber, content)
      )
      toast.success(t.game.war.noteSaved)
      patchPlacement(nodeNumber, { note: note.content, note_id: note.id })
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.loadError)
    }
  }

  const handleDeleteNote = async (nodeNumber: number) => {
    if (!selectedAllianceId || !activeWarId) return
    try {
      await write(() => deleteWarFightNote(selectedAllianceId, activeWarId, selectedBg, nodeNumber))
      toast.success(t.game.war.noteDeleted)
      patchPlacement(nodeNumber, { note: null, note_id: null, note_blocked: false })
    } catch (err: unknown) {
      toast.error((err as Error).message || t.game.war.noteDeleteError)
    }
  }

  // A report can push the note past the auto-block threshold, so the map is reloaded.
  const handleReportNote = async (noteId: string) => {
    try {
      await write(() => reportNote(noteId))
      toast.success(t.moderation.reportSuccess)
      await fetchWarDefense(true)
      return true
    } catch (err: unknown) {
      toast.error((err as Error).message || t.moderation.reportError)
      return false
    }
  }

  // ─── Context value ─────────────────────────────────────────────────────────

  const value = useMemo<WarContextValue>(
    () => ({
      alliances,
      selectedAllianceId,
      setSelectedAllianceId,
      handleAllianceChange,
      selectedBg,
      setSelectedBg,
      handleBgChange,
      loading,
      canManageWar,
      canPlaceWar,
      isVisitor,
      isMine,
      wars,
      selectedWarId,
      setSelectedWarId,
      hasActiveWar,
      isWarClosed,
      isMapReadOnly,
      currentWar,
      activeWarId,
      managementLoading,
      warLoading,
      placements,
      progress,
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
      handleEditWar,
      handleEndWar,
      refreshAlliances: refresh,
      handlePlaceDefender,
      handleRemoveDefender,
      handleConfirmRemoveDefender,
      handleClearBg,
      handleAssignAttacker,
      handleRemoveAttacker,
      handleAdjustKo,
      handleUpdateBoosts,
      loadAvailableAttackers,
      loadAvailablePrefightAttackers,
      synergies,
      handleAddSynergy,
      handleRemoveSynergy,
      prefights,
      handleAddPrefight,
      handleRemovePrefight,
      handleToggleCombatCompleted,
      handleToggleFightNotDone,
      handleTogglePlanningError,
      handleAssignAssist,
      handleRemoveAssist,
      handleSaveNote,
      handleDeleteNote,
      handleReportNote,
    }),
    // oxlint-disable-next-line react/exhaustive-deps
    [
      alliances,
      selectedAllianceId,
      handleAllianceChange,
      selectedBg,
      handleBgChange,
      loading,
      canManageWar,
      canPlaceWar,
      isVisitor,
      wars,
      selectedWarId,
      hasActiveWar,
      isWarClosed,
      isMapReadOnly,
      currentWar,
      activeWarId,
      managementLoading,
      warLoading,
      placements,
      progress,
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
  )

  return <WarContext.Provider value={value}>{children}</WarContext.Provider>
}
