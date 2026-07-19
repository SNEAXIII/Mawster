'use client'
import { AlertTriangle } from 'lucide-react'
import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ChampionFilterSelect from '@/app/game/knowledge-base/_components/champion-filter-select'
import { getChampions, type Champion } from '@/app/services/champions'
import {
  getAccessibleAlliances,
  importFightRecords,
  type ImportRow,
  type AccessibleAlliance,
} from '@/app/services/fight-records'
import { getMyAllianceRoles } from '@/app/services/game'

interface RawRow {
  attackerName: string
  defenderName: string
  node: number
  seasonName: string
  koCount: number
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCSV(text: string): RawRow[] {
  let lines = text.trim().split('\n')
  // Skip header row only if present (3rd column is not a numeric node)
  const firstParts = lines[0]?.split(',').map((p) => p.trim()) ?? []
  if (Number.isNaN(Number.parseInt(firstParts[2], 10))) lines = lines.slice(1)
  return lines
    .filter((line) => line.trim())
    .map((line, i) => {
      const parts = line.split(',').map((p) => p.trim())
      if (parts.length < 4) throw new Error(`Row ${i + 1}: expected at least 4 columns`)
      const node = Number.parseInt(parts[2], 10)
      const koRaw = parts[4] ?? ''
      const koCount = koRaw === '' ? 0 : Number.parseInt(koRaw, 10)
      if (Number.isNaN(node) || node < 1 || node > 50)
        throw new Error(`Row ${i + 1}: invalid node (1-50)`)
      if (Number.isNaN(koCount) || koCount < 0) throw new Error(`Row ${i + 1}: invalid ko_count`)
      return {
        attackerName: parts[0],
        defenderName: parts[1],
        node,
        seasonName: parts[3],
        koCount,
      }
    })
}

function NameCell({ name, resolved }: { name: string; resolved: boolean }) {
  if (resolved) return <span>{name}</span>
  return (
    <span className='inline-flex items-center gap-1.5 font-medium text-amber-500'>
      <AlertTriangle className='size-3.5 shrink-0' />
      {name}
    </span>
  )
}

export default function CsvImportForm() {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase
  const fileRef = useRef<HTMLInputElement>(null)

  const [champions, setChampions] = useState<Champion[]>([])
  const [alliances, setAlliances] = useState<AccessibleAlliance[]>([])
  const [selectedAllianceId, setSelectedAllianceId] = useState<string | null>(null)
  const [rows, setRows] = useState<RawRow[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string | null>>({})
  const [unknownLabels, setUnknownLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [resourcesLoaded, setResourcesLoaded] = useState(false)

  const loadResources = async (): Promise<Champion[]> => {
    const [champsData, accessibleAlliances, rolesData] = await Promise.all([
      getChampions(1, 9999),
      getAccessibleAlliances(),
      getMyAllianceRoles(),
    ])
    const champs = champsData.champions
    setChampions(champs)
    const managedAlliances = accessibleAlliances.filter(
      (a) => rolesData.roles[a.id]?.is_owner || rolesData.roles[a.id]?.is_officer
    )
    setAlliances(managedAlliances)
    if (managedAlliances.length === 1) {
      setSelectedAllianceId(managedAlliances[0].id)
    }
    setResourcesLoaded(true)
    return champs
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    let champs = champions
    if (!resourcesLoaded) {
      try {
        champs = await loadResources()
      } catch {
        toast.error(kb.importError)
        return
      }
    }

    const text = await file.text()
    try {
      const parsed = parseCSV(text)
      setRows(parsed)

      const unknownMap: Record<string, null> = {}
      const labels: Record<string, string> = {}
      const seen = new Set<string>()
      for (const r of parsed) {
        for (const name of [r.attackerName, r.defenderName]) {
          const key = normalizeName(name)
          if (seen.has(key)) continue
          seen.add(key)
          const match = champs.find((c) => normalizeName(c.name) === key)
          if (!match) {
            unknownMap[key] = null
            labels[key] = name.trim()
          }
        }
      }
      setNameMap(unknownMap)
      setUnknownLabels(labels)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : kb.importError
      toast.error(message)
    }
  }

  const resolveId = (name: string, champs: Champion[]): string | null => {
    const key = normalizeName(name)
    const direct = champs.find((c) => normalizeName(c.name) === key)
    if (direct) return direct.id
    return nameMap[key] ?? null
  }

  const unknownKeys = Object.keys(nameMap)
  const pendingCount = unknownKeys.filter((key) => !nameMap[key]).length
  const allResolved = rows.length > 0 && pendingCount === 0

  const handleImport = async () => {
    if (!selectedAllianceId) return
    const payload: ImportRow[] = rows.map((r) => ({
      champion_id: resolveId(r.attackerName, champions)!,
      defender_champion_id: resolveId(r.defenderName, champions)!,
      node_number: r.node,
      season_name: r.seasonName,
      ko_count: r.koCount,
    }))
    setLoading(true)
    try {
      const res = await importFightRecords(selectedAllianceId, { rows: payload })
      toast.success(kb.importSuccess.replace('{count}', String(res.imported)))
      if (res.skipped > 0) toast.info(kb.importSkipped.replace('{count}', String(res.skipped)))
      setRows([])
      setNameMap({})
      setUnknownLabels({})
      if (fileRef.current) fileRef.current.value = ''
    } catch {
      toast.error(kb.importError)
    } finally {
      setLoading(false)
    }
  }

  const blockedReason = !selectedAllianceId
    ? kb.importBlockedAlliance
    : pendingCount > 0
      ? kb.importBlockedUnresolved.replace('{count}', String(pendingCount))
      : null

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <p className='text-sm text-muted-foreground'>{kb.importUploadHint}</p>
        <Input
          ref={fileRef}
          type='file'
          accept='.csv'
          onChange={handleFile}
          data-cy='csv-file-input'
        />
      </div>

      {alliances.length > 1 && (
        <Select
          value={selectedAllianceId ?? ''}
          onValueChange={setSelectedAllianceId}
        >
          <SelectTrigger
            className='w-64'
            data-cy='import-alliance-trigger'
          >
            <SelectValue placeholder={kb.importAllianceLabel} />
          </SelectTrigger>
          <SelectContent>
            {alliances.map((a) => (
              <SelectItem
                key={a.id}
                value={a.id}
              >
                [{a.tag}] {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {unknownKeys.length > 0 && (
        <div
          className='space-y-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4'
          data-cy='import-resolve-panel'
        >
          <div className='flex items-start gap-2'>
            <AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-500' />
            <div className='space-y-1'>
              <p
                className='font-medium text-sm'
                data-cy='import-resolve-title'
              >
                {kb.importResolveTitle}
              </p>
              <p className='text-sm text-muted-foreground'>
                {kb.importResolveHint.replace('{count}', String(unknownKeys.length))}
              </p>
            </div>
          </div>
          {unknownKeys.map((key) => (
            <div
              key={key}
              className='flex flex-wrap items-center gap-3'
            >
              <span className='w-36 shrink-0 truncate text-sm'>
                {kb.importUnknown.replace('{name}', unknownLabels[key] ?? key)}
              </span>
              <ChampionFilterSelect
                value={nameMap[key]}
                onChange={(id) => setNameMap((m) => ({ ...m, [key]: id }))}
                placeholder={kb.selectChampion}
                data-cy={`champion-map-${key}`}
              />
              {!nameMap[key] && (
                <span className='rounded-full bg-amber-500/20 px-2 py-0.5 font-medium text-amber-500 text-xs'>
                  {kb.importUnmappedBadge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className='space-y-3'>
          <p className='font-medium text-sm'>
            {kb.importPreviewTitle.replace('{count}', String(rows.length))}
          </p>
          <div className='overflow-x-auto rounded-lg border'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-muted/50 text-muted-foreground'>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColAttacker}</th>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColDefender}</th>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColNode}</th>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColSeason}</th>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColKo}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const attackerOk = !!resolveId(row.attackerName, champions)
                  const defenderOk = !!resolveId(row.defenderName, champions)
                  return (
                    <tr
                      key={i}
                      className={`border-t ${!attackerOk || !defenderOk ? 'bg-amber-500/10' : ''}`}
                      data-cy={`import-row-${i}`}
                      data-unresolved={!attackerOk || !defenderOk}
                    >
                      <td className='px-3 py-1.5'>
                        <NameCell
                          name={row.attackerName}
                          resolved={attackerOk}
                        />
                      </td>
                      <td className='px-3 py-1.5'>
                        <NameCell
                          name={row.defenderName}
                          resolved={defenderOk}
                        />
                      </td>
                      <td className='px-3 py-1.5 text-muted-foreground'>{row.node}</td>
                      <td className='px-3 py-1.5 text-muted-foreground'>{row.seasonName}</td>
                      <td className='px-3 py-1.5 text-muted-foreground'>{row.koCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className='space-y-2'>
            {blockedReason && (
              <p
                className='flex items-center gap-1.5 text-amber-500 text-sm'
                data-cy='import-blocked-reason'
              >
                <AlertTriangle className='size-3.5 shrink-0' />
                {blockedReason}
              </p>
            )}
            <Button
              onClick={handleImport}
              disabled={loading || !allResolved || !selectedAllianceId}
              data-cy='import-confirm-btn'
            >
              {kb.importConfirmBtn.replace('{count}', String(rows.length))}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
