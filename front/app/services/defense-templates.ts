import type { SeasonFormat } from '@/app/services/season'
import { defenseRequest, jsonBody, type Quota } from '@/app/services/defense'

export interface DefenseTemplateNode {
  node_number: number
  champion_id: string
  champion_name: string
  champion_alias: string | null
  champion_class: string
  champion_image_url: string | null
}

export interface DefenseTemplateSummary {
  id: string
  name: string
  format: SeasonFormat
  filled_nodes: number
  created_at: string
}

export interface DefenseTemplate extends DefenseTemplateSummary {
  node_count: number
  nodes: DefenseTemplateNode[]
}

export interface DefenseTemplateList {
  templates: DefenseTemplateSummary[]
  quota: Quota
}

const templates = (allianceId: string) => `${allianceId}/defense/templates`
const template = (allianceId: string, id: string) => `${templates(allianceId)}/${id}`

export const listTemplates = (allianceId: string, format: SeasonFormat) =>
  defenseRequest<DefenseTemplateList>(
    `${templates(allianceId)}?format=${format}`,
    'Failed to load templates'
  )

export const createTemplate = (
  allianceId: string,
  name: string,
  format: SeasonFormat,
  sourceTemplateId?: string
) =>
  defenseRequest<DefenseTemplate>(
    templates(allianceId),
    'Failed to create template',
    jsonBody('POST', { name, format, source_template_id: sourceTemplateId })
  )

export const getTemplate = (allianceId: string, id: string) =>
  defenseRequest<DefenseTemplate>(template(allianceId, id), 'Failed to load template')

export const renameTemplate = (allianceId: string, id: string, name: string) =>
  defenseRequest<DefenseTemplate>(
    template(allianceId, id),
    'Failed to rename template',
    jsonBody('PATCH', { name })
  )

export const deleteTemplate = (allianceId: string, id: string) =>
  defenseRequest<void>(template(allianceId, id), 'Failed to delete template', jsonBody('DELETE'))

export const setTemplateNode = (allianceId: string, id: string, node: number, championId: string) =>
  defenseRequest<DefenseTemplate>(
    `${template(allianceId, id)}/nodes/${node}`,
    'Failed to place champion',
    jsonBody('PUT', { champion_id: championId })
  )

export const removeTemplateNode = (allianceId: string, id: string, node: number) =>
  defenseRequest<void>(
    `${template(allianceId, id)}/nodes/${node}`,
    'Failed to remove champion',
    jsonBody('DELETE')
  )
