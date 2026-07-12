'use client';

import { useI18n } from '@/app/i18n';
import { Input } from '@/components/ui/input';
import MatchupVerdictSelect from './matchup-verdict-select';
import type { MatchupVerdict } from '@/app/services/matchups';

interface Props {
  nodeNumber: string;
  onNodeChange: (value: string) => void;
  nodeVerdict: MatchupVerdict;
  onNodeVerdictChange: (verdict: MatchupVerdict) => void;
}

export default function MatchupFormNodeColumn({
  nodeNumber,
  onNodeChange,
  nodeVerdict,
  onNodeVerdictChange,
}: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  return (
    <div className='flex flex-col gap-3' data-cy='matchup-form-node-column'>
      <h3 className='text-sm font-medium text-muted-foreground'>{kb.vsNode}</h3>
      <Input
        className='w-24'
        type='number'
        min={1}
        max={50}
        placeholder={kb.filterNode}
        value={nodeNumber}
        onChange={(e) => onNodeChange(e.target.value)}
        data-cy='matchup-form-node'
      />
      {nodeNumber !== '' && (
        <MatchupVerdictSelect
          value={nodeVerdict}
          onChange={onNodeVerdictChange}
          data-cy='matchup-form-node-verdict'
        />
      )}
    </div>
  );
}
