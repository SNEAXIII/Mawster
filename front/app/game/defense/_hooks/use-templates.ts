'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import type { Quota } from '@/app/services/defense'
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  removeTemplateNode,
  renameTemplate,
  setTemplateNode,
  type DefenseTemplate,
  type DefenseTemplateSummary,
} from '@/app/services/defense-templates'
import type { SeasonFormat } from '@/app/services/season'

export function useTemplates(allianceId: string, format: SeasonFormat) {
  const { t } = useI18n()
  const m = t.game.defense.templates
  const [templates, setTemplates] = useState<DefenseTemplateSummary[]>([])
  const [quota, setQuota] = useState<Quota>({ used: 0, limit: 15 })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<DefenseTemplate | null>(null)

  const refresh = useCallback(
    async (preferId?: string | null) => {
      if (!allianceId) return
      const list = await listTemplates(allianceId, format)
      setTemplates(list.templates)
      setQuota(list.quota)
      const keep = list.templates.find((tpl) => tpl.id === preferId)?.id
      setSelectedId(keep ?? list.templates[0]?.id ?? null)
    },
    [allianceId, format]
  )

  useEffect(() => {
    refresh().catch(() => toast.error(t.game.defense.loadError))
  }, [refresh, t])

  useEffect(() => {
    if (!selectedId) {
      setSelected(null)
      return
    }
    getTemplate(allianceId, selectedId)
      .then(setSelected)
      .catch(() => toast.error(t.game.defense.loadError))
  }, [allianceId, selectedId, t])

  const run = async (action: () => Promise<unknown>, success: string, preferId?: string | null) => {
    try {
      const result = await action()
      toast.success(success)
      const createdId = (result as DefenseTemplate | undefined)?.id
      const keptId = createdId ?? (preferId !== undefined ? preferId : selectedId)
      await refresh(keptId)
      if (result && (result as DefenseTemplate).nodes) {
        setSelected(result as DefenseTemplate)
      } else if (keptId && keptId === selectedId) {
        setSelected(await getTemplate(allianceId, keptId))
      }
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  return {
    templates,
    quota,
    selected,
    selectedId,
    setSelectedId,
    create: (name: string) => run(() => createTemplate(allianceId, name, format), m.created),
    duplicate: (name: string) =>
      run(() => createTemplate(allianceId, name, format, selectedId ?? undefined), m.created),
    rename: (name: string) =>
      selectedId && run(() => renameTemplate(allianceId, selectedId, name), m.renamed),
    remove: () => selectedId && run(() => deleteTemplate(allianceId, selectedId), m.deleted, null),
    placeChampion: (node: number, championId: string, name: string) =>
      selectedId &&
      run(
        () => setTemplateNode(allianceId, selectedId, node, championId),
        m.placed.replace('{name}', name).replace('{node}', String(node))
      ),
    removeNode: (node: number) =>
      selectedId &&
      run(() => removeTemplateNode(allianceId, selectedId, node), t.game.defense.removeSuccess),
  }
}
