'use client'

import { toast } from 'sonner'
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

interface PlanCommandsOptions {
  allianceId: string
  bg: number
  selected: DefensePlanSummary | null
  onChanged: (planId?: string) => void
}

export function usePlanCommands({ allianceId, bg, selected, onChanged }: PlanCommandsOptions) {
  const { t } = useI18n()
  const p = t.game.defense.plans

  const run = async <T>(action: () => Promise<T>, success: string): Promise<T | undefined> => {
    try {
      const result = await action()
      toast.success(success)
      return result
    } catch (err: unknown) {
      toast.error((err as Error).message)
      return undefined
    }
  }

  const create = async (body: CreatePlanBody) => {
    const created = await run(() => createPlan(allianceId, bg, body), p.created)
    if (created) onChanged(created.id)
  }

  const duplicate = async (name: string) => {
    if (!selected) return
    await create({ name, format: selected.format, source_plan_id: selected.id })
  }

  const rename = async (name: string) => {
    if (!selected) return
    if (await run(() => renamePlan(allianceId, selected.id, name), p.renamed))
      onChanged(selected.id)
  }

  const remove = async () => {
    if (!selected) return
    await run(() => deletePlan(allianceId, selected.id), p.deleted)
    onChanged()
  }

  const activate = async () => {
    if (!selected) return
    if (await run(() => activatePlan(allianceId, selected.id), p.activated)) onChanged(selected.id)
  }

  const saveAsTemplate = async (name: string) => {
    if (!selected) return
    await run(() => savePlanAsTemplate(allianceId, selected.id, name), p.savedAsTemplate)
  }

  return { create, duplicate, rename, remove, activate, saveAsTemplate }
}
