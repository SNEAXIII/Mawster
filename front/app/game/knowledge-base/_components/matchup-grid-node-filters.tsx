'use client';

import { useI18n } from '@/app/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PATHS, SECTIONS } from './node-filters';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

// One merged client-side column filter for the grids: 'all', a war-map section, or a path.
export default function MatchupGridNodeFilters({ value, onChange }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;
  const sectionLabels: Record<number, string> = {
    1: kb.tier1,
    2: kb.tier2,
    3: kb.miniBoss,
    4: kb.boss,
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className='h-7 w-40 text-xs' data-cy='matchup-grid-node-filter'>
        <SelectValue placeholder={kb.allNodes} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='all'>{kb.allNodes}</SelectItem>
        {SECTIONS.map((s) => (
          <SelectItem key={`section-${s}`} value={`section-${s}`} data-cy={`matchup-grid-section-${s}`}>
            {sectionLabels[s]}
          </SelectItem>
        ))}
        {PATHS.map((p) => (
          <SelectItem key={`path-${p}`} value={`path-${p}`} data-cy={`matchup-grid-path-${p}`}>
            {kb.pathLabel} {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
