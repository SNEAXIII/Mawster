'use client';

import { useI18n } from '@/app/i18n';
import { Switch } from '@/components/ui/switch';
import ChampionFilterSelect from './champion-filter-select';

export interface SynergyDraft {
  championId: string | null;
  isRequired: boolean;
}

interface Props {
  index: number;
  synergy: SynergyDraft;
  onChange: (index: number, synergy: SynergyDraft) => void;
}

export default function MatchupSynergyField({ index, synergy, onChange }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  return (
    <span className='flex items-center gap-2'>
      <ChampionFilterSelect
        value={synergy.championId}
        onChange={(id) => onChange(index, { ...synergy, championId: id })}
        placeholder={`${kb.formSynergy} ${index + 1}`}
        data-cy={`matchup-form-synergy-${index + 1}`}
      />
      <Switch
        checked={synergy.isRequired}
        onCheckedChange={(checked) => onChange(index, { ...synergy, isRequired: checked })}
        data-cy={`matchup-form-synergy-${index + 1}-required`}
        aria-label={kb.formRequiredSwitch}
      />
    </span>
  );
}
