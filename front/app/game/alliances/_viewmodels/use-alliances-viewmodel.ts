'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useI18n } from '@/app/i18n'
import { toast } from 'sonner'
import {
  type GameAccount,
  getMyGameAccounts,
  getEligibleOwners,
  getEligibleMembers,
  getEligibleVisitors,
  createAlliance,
  inviteMember,
  inviteVisitor,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
} from '@/app/services/game'
import { useRequiredSession } from '@/hooks/use-required-session'
import { useAllianceContext } from '@/app/contexts/alliance-context'
import { getCurrentSeasonStatistics, type PlayerSeasonStats } from '@/app/services/statistics'

export enum AllianceTab {
  Create = 'create',
  Alliances = 'alliances',
  Defense = 'defense',
  Statistics = 'statistics',
  ChampionSearch = 'champion-search',
}

export function useAlliancesViewModel() {
  const { locale, t } = useI18n()
  const { status } = useRequiredSession()
  const {
    alliances,
    loading,
    myInvitations,
    pendingInvitations,
    refresh: refreshAlliances,
  } = useAllianceContext()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [eligibleOwners, setEligibleOwners] = useState<GameAccount[]>([])
  const [eligibleMembers, setEligibleMembers] = useState<GameAccount[]>([])
  const [eligibleVisitors, setEligibleVisitors] = useState<GameAccount[]>([])
  const [hasAnyAccounts, setHasAnyAccounts] = useState(true)
  const [creating, setCreating] = useState(false)
  const [statsAllianceId, setStatsAllianceId] = useState('')
  const [seasonStats, setSeasonStats] = useState<PlayerSeasonStats[]>([])
  const [statsWarId, setStatsWarId] = useState<string | null>(null)
  const [statsSeasonId, setStatsSeasonId] = useState<string | null>(null)
  const [statsRefreshing, setStatsRefreshing] = useState(false)
  const [statsError, setStatsError] = useState('')

  const initialTab = (searchParams.get('tab') as AllianceTab) || AllianceTab.Alliances
  const [activeTab, setActiveTab] = useState<AllianceTab>(
    Object.values(AllianceTab).includes(initialTab) ? initialTab : AllianceTab.Alliances
  )

  const handleDefenseStateChange = useCallback(
    (allianceId: string, bg: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('tab', AllianceTab.Defense)
      params.set('alliance', allianceId)
      params.set('bg', String(bg))
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, searchParams, router]
  )

  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', activeTab)
    if (activeTab !== AllianceTab.Defense) {
      params.delete('alliance')
      params.delete('bg')
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [memberAllianceId, setMemberAllianceId] = useState<string | null>(null)
  const [memberAccountId, setMemberAccountId] = useState('')
  const [inviteType, setInviteType] = useState<'member' | 'visitor'>('member')
  const [rosterTarget, setRosterTarget] = useState<{
    gameAccountId: string
    pseudo: string
    canRequestUpgrade: boolean
  } | null>(null)

  const fetchEligibleOwners = async () => {
    try {
      const data = await getEligibleOwners()
      setEligibleOwners(data)
      if (data.length > 0 && !ownerId) setOwnerId(data[0].id)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchEligibleMembers = async () => {
    try {
      setEligibleMembers(await getEligibleMembers())
    } catch (err) {
      console.error(err)
    }
  }

  const fetchEligibleVisitors = async (allianceId: string) => {
    try {
      setEligibleVisitors(await getEligibleVisitors(allianceId))
    } catch (err) {
      console.error(err)
    }
  }

  const fetchMyAccounts = async () => {
    try {
      const data = await getMyGameAccounts()
      setHasAnyAccounts(data.length > 0)
    } catch (err) {
      console.error(err)
    }
  }

  const loadSeasonStats = useCallback(
    async (allianceId: string, warId?: string | null, seasonId?: string | null) => {
      setStatsRefreshing(true)
      setStatsError('')
      try {
        const stats = await getCurrentSeasonStatistics(
          allianceId,
          warId ?? undefined,
          seasonId ?? undefined
        )
        setSeasonStats(stats)
      } catch (err: unknown) {
        console.error(err)
        setSeasonStats([])
        setStatsError((err as Error).message || t.game.alliances.statistics.loadError)
      } finally {
        setStatsRefreshing(false)
      }
    },
    [t.game.alliances.statistics.loadError]
  )

  const refreshMembership = () =>
    Promise.all([
      refreshAlliances(),
      fetchEligibleOwners(),
      fetchEligibleMembers(),
      fetchMyAccounts(),
    ])

  useEffect(() => {
    if (status === 'authenticated') {
      Promise.all([fetchEligibleOwners(), fetchMyAccounts()])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  useEffect(() => {
    if (!loading && activeTab === AllianceTab.Create && eligibleOwners.length === 0) {
      router.replace('/game/alliances')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, activeTab, eligibleOwners])

  useEffect(() => {
    if (activeTab !== AllianceTab.Statistics && activeTab !== AllianceTab.ChampionSearch) return
    if (alliances.length === 0) {
      setStatsAllianceId('')
      setSeasonStats([])
      return
    }

    const allianceExists = alliances.some((alliance) => alliance.id === statsAllianceId)
    const targetAllianceId = allianceExists ? statsAllianceId : alliances[0].id

    if (statsAllianceId !== targetAllianceId) {
      setStatsAllianceId(targetAllianceId)
      return
    }

    if (activeTab === AllianceTab.Statistics) {
      loadSeasonStats(targetAllianceId, statsWarId, statsSeasonId).catch(() => {})
    }
  }, [activeTab, alliances, statsAllianceId, statsWarId, statsSeasonId, loadSeasonStats])

  const handleStatsAllianceChange = (allianceId: string) => {
    setStatsAllianceId(allianceId)
    // Wars are alliance-scoped: keeping the previous selection would filter on a
    // war that does not belong to the newly selected alliance.
    setStatsWarId(null)
    setStatsSeasonId(null)
  }

  const handleStatsWarChange = (warId: string | null) => {
    setStatsWarId(warId)
  }

  const handleStatsSeasonChange = (seasonId: string | null) => {
    setStatsSeasonId(seasonId)
    // A war belongs to a single season, so the current war selection cannot
    // survive a season change.
    setStatsWarId(null)
  }

  const handleRefreshStatistics = async () => {
    if (!statsAllianceId) return
    await loadSeasonStats(statsAllianceId, statsWarId, statsSeasonId)
  }

  const ALLIANCE_NAME_REGEX = /^[a-zA-Z0-9 ]{3,50}$/
  const ALLIANCE_TAG_REGEX = /^[a-zA-Z0-9]{1,5}$/

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !tag.trim() || !ownerId) return
    if (!ALLIANCE_NAME_REGEX.test(name.trim())) {
      toast.error(t.game.alliances.nameInvalid)
      return
    }
    if (!ALLIANCE_TAG_REGEX.test(tag.trim())) {
      toast.error(t.game.alliances.tagInvalid)
      return
    }
    setCreating(true)
    try {
      await createAlliance(name.trim(), tag.trim(), ownerId)
      toast.success(t.game.alliances.createSuccess)
      setName('')
      setTag('')
      setOwnerId('')
      setActiveTab(AllianceTab.Alliances)
      await refreshMembership()
    } catch (err: unknown) {
      console.error(err)
      toast.error((err as Error).message || t.game.alliances.createError)
    } finally {
      setCreating(false)
    }
  }

  const handleOpenInviteMember = (allianceId: string) => {
    setMemberAllianceId(allianceId)
    setMemberAccountId('')
    setInviteType('member')
    void Promise.all([fetchEligibleMembers(), fetchEligibleVisitors(allianceId)])
  }

  const handleInviteTypeChange = (type: 'member' | 'visitor') => {
    setInviteType(type)
    setMemberAccountId('')
  }

  const handleCloseInviteMember = () => {
    setMemberAllianceId(null)
    setMemberAccountId('')
    setInviteType('member')
  }

  const handleInviteMember = async (allianceId: string) => {
    if (!memberAccountId) return
    try {
      if (inviteType === 'visitor') {
        await inviteVisitor(allianceId, memberAccountId)
      } else {
        await inviteMember(allianceId, memberAccountId)
      }
      toast.success(t.game.alliances.inviteSuccess)
      setMemberAllianceId(null)
      setMemberAccountId('')
      await Promise.all([fetchEligibleMembers(), refreshAlliances()])
    } catch (err: unknown) {
      console.error(err)
      toast.error((err as Error).message || t.game.alliances.inviteError)
    }
  }

  // Also refreshes the eligible owners: any membership change — a member
  // leaving, the alliance being disbanded — can free a game account, and the
  // "Create" tab only shows up when at least one is eligible.
  const handleMemberRefresh = async () => {
    await refreshMembership()
  }

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await acceptInvitation(invitationId)
      toast.success(t.game.alliances.acceptInvitationSuccess)
      await refreshMembership()
    } catch (err: unknown) {
      console.error(err)
      toast.error((err as Error).message || t.game.alliances.acceptInvitationError)
    }
  }

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      await declineInvitation(invitationId)
      toast.success(t.game.alliances.declineInvitationSuccess)
      await refreshAlliances()
    } catch (err: unknown) {
      console.error(err)
      toast.error((err as Error).message || t.game.alliances.declineInvitationError)
    }
  }

  const handleCancelInvitation = async (allianceId: string, invitationId: string) => {
    try {
      await cancelInvitation(allianceId, invitationId)
      toast.success(t.game.alliances.cancelInvitationSuccess)
      await Promise.all([fetchEligibleMembers(), refreshAlliances()])
    } catch (err: unknown) {
      console.error(err)
      toast.error((err as Error).message || t.game.alliances.cancelInvitationError)
    }
  }

  return {
    locale,
    status,
    alliances,
    loading,
    eligibleOwners,
    eligibleMembers,
    eligibleVisitors,
    hasAnyAccounts,
    creating,
    activeTab,
    myInvitations,
    pendingInvitations,
    name,
    tag,
    ownerId,
    memberAllianceId,
    memberAccountId,
    inviteType,
    rosterTarget,
    statsAllianceId,
    seasonStats,
    statsWarId,
    handleStatsWarChange,
    statsSeasonId,
    handleStatsSeasonChange,
    // Blank the panel only while there is nothing to show yet. A filter refetch
    // keeps the previous rows on screen so the filter bar never unmounts.
    statsLoading: statsRefreshing && seasonStats.length === 0,
    statsRefreshing,
    statsError,
    searchParams,
    setActiveTab,
    setName,
    setTag,
    setOwnerId,
    setMemberAccountId,
    setInviteType,
    setRosterTarget,
    handleInviteTypeChange,
    handleCreate,
    handleOpenInviteMember,
    handleCloseInviteMember,
    handleInviteMember,
    handleMemberRefresh,
    handleAcceptInvitation,
    handleDeclineInvitation,
    handleCancelInvitation,
    handleDefenseStateChange,
    handleStatsAllianceChange,
    handleRefreshStatistics,
  }
}
