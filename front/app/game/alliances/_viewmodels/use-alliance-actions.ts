'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { useAllianceContext } from '@/app/contexts/alliance-context'
import {
  type Alliance,
  type AllianceVisitor,
  addOfficer,
  addStrategist,
  deleteAlliance,
  getAllianceVisitors,
  inviteMember,
  kickVisitor,
  leaveAsVisitor,
  patchAllianceElo,
  patchAllianceTier,
  removeMember,
  removeOfficer,
  removeStrategist,
  setMemberGroup,
  transferOwnership,
} from '@/app/services/game'

export const AllianceMemberAction = {
  PROMOTE: 'promote',
  DEMOTE: 'demote',
  PROMOTE_STRATEGIST: 'promote_strategist',
  DEMOTE_STRATEGIST: 'demote_strategist',
  REMOVE: 'remove',
  LEAVE: 'leave',
  TRANSFER_OWNER: 'transfer_owner',
} as const

export type AllianceMemberAction = (typeof AllianceMemberAction)[keyof typeof AllianceMemberAction]

interface MemberRef {
  id: string
  game_pseudo: string
}

// An Error carrying an empty message must fall through to the fallback, hence the
// truthiness check rather than a bare `??` on err.message.
const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

export function useAllianceActions(refreshMembership: () => Promise<unknown>) {
  const { t } = useI18n()
  const { applyAlliance } = useAllianceContext()
  const [visitors, setVisitors] = useState<Record<string, AllianceVisitor[]>>({})

  const memberCalls: Record<
    AllianceMemberAction,
    { call: (allianceId: string, memberId: string) => Promise<Alliance>; error: string }
  > = {
    promote: { call: addOfficer, error: t.game.alliances.officerAddError },
    demote: { call: removeOfficer, error: t.game.alliances.officerRemoveError },
    promote_strategist: { call: addStrategist, error: t.game.alliances.strategistAddError },
    demote_strategist: { call: removeStrategist, error: t.game.alliances.strategistRemoveError },
    remove: { call: removeMember, error: t.game.alliances.memberRemoveError },
    leave: { call: removeMember, error: t.game.alliances.leaveError },
    transfer_owner: { call: transferOwnership, error: t.game.alliances.transferOwnerError },
  }

  const memberSuccess = (action: AllianceMemberAction, member: MemberRef) =>
    ({
      promote: t.game.alliances.officerAddSuccess,
      demote: t.game.alliances.officerRemoveSuccess,
      promote_strategist: t.game.alliances.strategistAddSuccess,
      demote_strategist: t.game.alliances.strategistRemoveSuccess,
      remove: t.game.alliances.memberRemoveSuccess,
      leave: t.game.alliances.leaveSuccess,
      transfer_owner: t.game.alliances.transferOwnerSuccess.replace('{pseudo}', member.game_pseudo),
    })[action]

  const runMemberAction = async (
    allianceId: string,
    member: MemberRef,
    action: AllianceMemberAction
  ) => {
    try {
      applyAlliance(await memberCalls[action].call(allianceId, member.id))
      toast.success(memberSuccess(action, member))
      await refreshMembership()
      return true
    } catch (err: unknown) {
      console.error(err)
      toast.error(errorMessage(err, memberCalls[action].error))
      return false
    }
  }

  const changeMemberGroup = async (allianceId: string, member: MemberRef, group: number | null) => {
    try {
      applyAlliance(await setMemberGroup(allianceId, member.id, group))
      const groupLabel = group ? `${t.game.alliances.group} ${group}` : t.game.alliances.noGroup
      toast.success(
        t.game.alliances.groupSetSuccess
          .replace('{pseudo}', member.game_pseudo)
          .replace('{group}', groupLabel)
      )
    } catch (err: unknown) {
      toast.error(errorMessage(err, t.game.alliances.groupSetError))
    }
  }

  const updateElo = async (allianceId: string, elo: number) => {
    try {
      applyAlliance(await patchAllianceElo(allianceId, elo))
      toast.success(t.game.war.eloUpdateSuccess)
    } catch (err: unknown) {
      toast.error(errorMessage(err, t.game.war.eloUpdateError))
    }
  }

  const updateTier = async (allianceId: string, tier: number) => {
    try {
      applyAlliance(await patchAllianceTier(allianceId, tier))
      toast.success(t.game.war.tierUpdateSuccess)
    } catch (err: unknown) {
      toast.error(errorMessage(err, t.game.war.tierUpdateError))
    }
  }

  const disband = async (alliance: Alliance) => {
    try {
      await deleteAlliance(alliance.id, alliance.name)
      toast.success(t.game.alliances.deleteSuccess)
      await refreshMembership()
    } catch (err: unknown) {
      console.error(err)
      toast.error(errorMessage(err, t.game.alliances.deleteError))
    }
  }

  const leaveVisit = async (allianceId: string) => {
    try {
      await leaveAsVisitor(allianceId)
      toast.success(t.game.alliances.leaveVisitSuccess)
      await refreshMembership()
      return true
    } catch (err: unknown) {
      console.error(err)
      toast.error(errorMessage(err, t.game.alliances.leaveVisitError))
      return false
    }
  }

  const loadVisitors = useCallback(async (allianceId: string) => {
    try {
      const list = await getAllianceVisitors(allianceId)
      setVisitors((prev) => ({ ...prev, [allianceId]: list }))
    } catch {
      setVisitors((prev) => ({ ...prev, [allianceId]: [] }))
    }
  }, [])

  const removeVisitor = async (allianceId: string, visitor: AllianceVisitor) => {
    try {
      await kickVisitor(allianceId, visitor.game_account_id)
      await Promise.all([loadVisitors(allianceId), refreshMembership()])
    } catch (err: unknown) {
      toast.error(errorMessage(err, t.common.error))
    }
  }

  const inviteVisitorAsMember = async (allianceId: string, visitor: AllianceVisitor) => {
    try {
      await inviteMember(allianceId, visitor.game_account_id)
      await refreshMembership()
    } catch (err: unknown) {
      toast.error(errorMessage(err, t.game.alliances.inviteError))
    }
  }

  return {
    visitors,
    runMemberAction,
    changeMemberGroup,
    updateElo,
    updateTier,
    disband,
    leaveVisit,
    loadVisitors,
    removeVisitor,
    inviteVisitorAsMember,
  }
}

export type AllianceActions = ReturnType<typeof useAllianceActions>
