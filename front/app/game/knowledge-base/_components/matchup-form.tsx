'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChampionFilterSelect from './champion-filter-select';
import MatchupVerdictSelect from './matchup-verdict-select';
import MatchupSynergyField, { type SynergyDraft } from './matchup-synergy-field';
import type { MatchupTargetInput, MatchupUpsertBody, MatchupVerdict } from '@/app/services/matchups';

interface Props {
  onSubmit: (body: MatchupUpsertBody) => Promise<void>;
}

const EMPTY_SYNERGIES: SynergyDraft[] = [
  { championId: null, isRequired: true },
  { championId: null, isRequired: true },
];

export default function MatchupForm({ onSubmit }: Readonly<Props>) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  const [attackerId, setAttackerId] = useState<string | null>(null);
  const [defenderId, setDefenderId] = useState<string | null>(null);
  const [defenderVerdict, setDefenderVerdict] = useState<MatchupVerdict>('ok');
  const [nodeNumber, setNodeNumber] = useState('');
  const [nodeVerdict, setNodeVerdict] = useState<MatchupVerdict>('ok');
  const [prefightId, setPrefightId] = useState<string | null>(null);
  const [synergies, setSynergies] = useState<SynergyDraft[]>(EMPTY_SYNERGIES);
  const [submitting, setSubmitting] = useState(false);

  const hasTarget = defenderId !== null || nodeNumber !== '';
  const canSubmit = attackerId !== null && hasTarget && !submitting;

  function updateSynergy(index: number, synergy: SynergyDraft) {
    setSynergies((current) => current.map((s, i) => (i === index ? synergy : s)));
  }

  function buildTargets(): MatchupTargetInput[] {
    const synergyPayload = synergies
      .filter((s): s is { championId: string; isRequired: boolean } => s.championId !== null)
      .map((s) => ({ champion_id: s.championId, is_required: s.isRequired }));
    const shared = { prefight_champion_id: prefightId, synergies: synergyPayload };

    const targets: MatchupTargetInput[] = [];
    if (defenderId !== null) {
      targets.push({
        target_type: 'defender',
        defender_champion_id: defenderId,
        verdict: defenderVerdict,
        ...shared,
      });
    }
    if (nodeNumber !== '') {
      targets.push({
        target_type: 'node',
        node_number: Number(nodeNumber),
        verdict: nodeVerdict,
        ...shared,
      });
    }
    return targets;
  }

  async function handleSubmit() {
    if (!canSubmit || attackerId === null) return;
    setSubmitting(true);
    try {
      await onSubmit({ champion_id: attackerId, targets: buildTargets() });
      setDefenderId(null);
      setNodeNumber('');
      setPrefightId(null);
      setSynergies(EMPTY_SYNERGIES);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className='rounded-md border bg-card p-4 flex flex-wrap gap-3 items-end'
      data-cy='matchup-form'
    >
      <ChampionFilterSelect
        value={attackerId}
        onChange={setAttackerId}
        placeholder={kb.formAttacker}
        data-cy='matchup-form-attacker'
      />
      <ChampionFilterSelect
        value={defenderId}
        onChange={setDefenderId}
        placeholder={kb.filterDefender}
        data-cy='matchup-form-defender'
      />
      {defenderId !== null && (
        <MatchupVerdictSelect
          value={defenderVerdict}
          onChange={setDefenderVerdict}
          data-cy='matchup-form-defender-verdict'
        />
      )}
      <Input
        className='w-24'
        type='number'
        min={1}
        max={50}
        placeholder={kb.filterNode}
        value={nodeNumber}
        onChange={(e) => setNodeNumber(e.target.value)}
        data-cy='matchup-form-node'
      />
      {nodeNumber !== '' && (
        <MatchupVerdictSelect
          value={nodeVerdict}
          onChange={setNodeVerdict}
          data-cy='matchup-form-node-verdict'
        />
      )}
      {synergies.map((synergy, index) => (
        <MatchupSynergyField
          key={index}
          index={index}
          synergy={synergy}
          onChange={updateSynergy}
        />
      ))}
      <ChampionFilterSelect
        value={prefightId}
        onChange={setPrefightId}
        placeholder={kb.formPrefight}
        data-cy='matchup-form-prefight'
      />
      <Button onClick={handleSubmit} disabled={!canSubmit} data-cy='matchup-form-submit'>
        {kb.formSubmit}
      </Button>
      {!hasTarget && (
        <p className='text-muted-foreground text-xs w-full'>{kb.formNeedsTarget}</p>
      )}
    </div>
  );
}
