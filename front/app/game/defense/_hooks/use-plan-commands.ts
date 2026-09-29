'use client'

import { useI18n } from '@/app/i18n'
import {
  activatePlan,
  createPlan,
  deletePlan,
  renamePlan,
  savePlanAsTemplate,
  type CreatePlanBody,
  type DefensePlanSummary,
} from '@/app/services/defense'
import { withToast } from './with-toast'

interface PlanCommandsOptions {
  allianceId: string
  bg: number
  selected: DefensePlanSummary | null
  onChanged: (planId?: string) => void
}

export function usePlanCommands({ allianceId, bg, selected, onChanged }: PlanCommandsOptions) {
  const { t } = useI18n()
  const p = t.game.defense.plans

  const create = async (body: CreatePlanBody) => {
    const created = await withToast(() => createPlan(allianceId, bg, body), p.created)
    if (created) onChanged(created.id)
  }

  const duplicate = async (name: string) => {
    if (!selected) return
    await create({ name, format: selected.format, source_plan_id: selected.id })
  }

  const rename = async (name: string) => {
    if (!selected) return
    if (await withToast(() => renamePlan(allianceId, selected.id, name), p.renamed))
      onChanged(selected.id)
  }

  const remove = async () => {
    if (!selected) return
    await withToast(() => deletePlan(allianceId, selected.id), p.deleted)
    onChanged()
  }

  const activate = async () => {
    if (!selected) return
    if (await withToast(() => activatePlan(allianceId, selected.id), p.activated))
      onChanged(selected.id)
  }

  const saveAsTemplate = async (name: string) => {
    if (!selected) return
    await withToast(() => savePlanAsTemplate(allianceId, selected.id, name), p.savedAsTemplate)
  }

  return { create, duplicate, rename, remove, activate, saveAsTemplate }
}
