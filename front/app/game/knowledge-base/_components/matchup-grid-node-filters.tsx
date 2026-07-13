'use client'

import { useI18n } from '@/app/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PATHS, SECTIONS, pathsAvailable } from './node-filters'

interface Props {
  section: number | null
  path: number | null
  onSection: (value: number | null) => void
  onPath: (value: number | null) => void
}

// Client-side column filters for the grids: a war-map tier, plus a path that is only offered
// for tiers 1-2 (or no tier), since paths do not run through the miniboss/boss tiers.
export default function MatchupGridNodeFilters({
  section,
  path,
  onSection,
  onPath,
}: Readonly<Props>) {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase
  const sectionLabels: Record<number, string> = {
    1: kb.tier1,
    2: kb.tier2,
    3: kb.miniBoss,
    4: kb.boss,
  }

  const handleSection = (value: string) => {
    const next = value === 'all' ? null : Number(value)
    onSection(next)
    if (!pathsAvailable(next)) onPath(null)
  }

  return (
    <div className='flex flex-wrap gap-2 items-center'>
      <Select
        value={section === null ? 'all' : String(section)}
        onValueChange={handleSection}
      >
        <SelectTrigger
          className='h-7 w-32 text-xs'
          data-cy='matchup-grid-section'
        >
          <SelectValue placeholder={kb.allTiers} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>{kb.allTiers}</SelectItem>
          {SECTIONS.map((s) => (
            <SelectItem
              key={s}
              value={String(s)}
              data-cy={`matchup-grid-section-${s}`}
            >
              {sectionLabels[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pathsAvailable(section) && (
        <Select
          value={path === null ? 'all' : String(path)}
          onValueChange={(v) => onPath(v === 'all' ? null : Number(v))}
        >
          <SelectTrigger
            className='h-7 w-32 text-xs'
            data-cy='matchup-grid-path'
          >
            <SelectValue placeholder={kb.allPaths} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{kb.allPaths}</SelectItem>
            {PATHS.map((p) => (
              <SelectItem
                key={p}
                value={String(p)}
                data-cy={`matchup-grid-path-${p}`}
              >
                {kb.pathLabel} {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
