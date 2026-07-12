'use client';

import { useI18n } from '@/app/i18n';
import ChampionFilterSelect from './champion-filter-select';
import MatchupVerdictSelect from './matchup-verdict-select';
import MatchupSynergyField, { type SynergyDraft } from './matchup-synergy-field';
import type { MatchupVerdict } from '@/app/services/matchups';

interface Props {
  defenderId: string | null;
  onDefenderChange: (id: string | null) => void;
  defenderVerdict: MatchupVerdict;
  onDefenderVerdictChange: (verdict: MatchupVerdict) => void;
  synergies: SynergyDraft[];
  onSynergyChange: (index: number, synergy: SynergyDraft) => void;
  prefightId: string | null;
  onPrefightChange: (id: string | null) => void;
}

export default function MatchupFormDefenderColumn({
  defenderId,
  onDefenderChange,
  defenderVerdict,
  onDefenderVerdictChange,
  synergies,
  onSynergyChange,
  prefightId,
  onPrefightChange,
}: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  return (
    <div className='flex flex-col gap-3' data-cy='matchup-form-defender-column'>
      <h3 className='text-sm font-medium text-muted-foreground'>{kb.vsDefender}</h3>
      <ChampionFilterSelect
        value={defenderId}
        onChange={onDefenderChange}
        placeholder={kb.filterDefender}
        data-cy='matchup-form-defender'
      />
      {defenderId !== null && (
        <MatchupVerdictSelect
          value={defenderVerdict}
          onChange={onDefenderVerdictChange}
          data-cy='matchup-form-defender-verdict'
        />
      )}
      <div className='flex flex-wrap items-center gap-3'>
        {synergies.map((synergy, index) => (
          <MatchupSynergyField
            key={index}
            index={index}
            synergy={synergy}
            onChange={onSynergyChange}
          />
        ))}
      </div>
      <ChampionFilterSelect
        value={prefightId}
        onChange={onPrefightChange}
        placeholder={kb.formPrefight}
        data-cy='matchup-form-prefight'
      />
    </div>
  );
}
