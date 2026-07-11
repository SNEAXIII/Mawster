'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { getAllianceRoster } from '@/app/services/game';
import { useMatchupsViewModel } from '../_viewmodels/use-matchups-viewmodel';
import MatchupEvaluationFilters from './matchup-evaluation-filters';
import MatchupEvaluationTable from './matchup-evaluation-table';
import MatchupForm from './matchup-form';
import MatchupGridTable from './matchup-grid-table';
import MatchupTable from './matchup-table';

export default function MatchupsTab() {
  const { t } = useI18n();
  const vm = useMatchupsViewModel();
  const [pseudoToAccountId, setPseudoToAccountId] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!vm.allianceId) return;
    getAllianceRoster(vm.allianceId)
      .then((entries) => {
        const map: Record<string, string> = {};
        entries.forEach((entry) => {
          map[entry.game_pseudo] = entry.game_account_id;
        });
        setPseudoToAccountId(map);
      })
      .catch(() => setPseudoToAccountId({}));
  }, [vm.allianceId]);

  const players = Object.keys(pseudoToAccountId).sort((a, b) => a.localeCompare(b));
  const selectedPseudo =
    Object.entries(pseudoToAccountId).find(([, id]) => id === vm.filters.gameAccountId)?.[0] ?? '';

  return (
    <div className='flex flex-col gap-4' data-cy='matchups-tab'>
      {vm.canEdit && (
        <>
          <MatchupForm onSubmit={vm.saveMatchup} />
          <MatchupTable ratings={vm.ratings} onDelete={vm.removeMatchup} />
        </>
      )}
      <MatchupEvaluationFilters
        alliances={vm.alliances}
        allianceId={vm.allianceId}
        onAllianceChange={vm.setAllianceId}
        players={players}
        filters={{ ...vm.filters, gameAccountId: selectedPseudo }}
        onChange={(key, value) =>
          key === 'gameAccountId'
            ? vm.setFilter('gameAccountId', pseudoToAccountId[value as string] ?? '')
            : vm.setFilter(key, value)
        }
        onClear={vm.clearFilters}
      />
      {vm.showGrid && <MatchupGridTable grid={vm.grid} loading={vm.loading} />}
      {!vm.showGrid && !vm.hasTarget && (
        <p className='text-muted-foreground text-sm' data-cy='matchup-hint'>
          {t.game.knowledgeBase.selectTargetHint}
        </p>
      )}
      {!vm.showGrid && vm.hasTarget && (
        <MatchupEvaluationTable rows={vm.rows} loading={vm.loading} />
      )}
    </div>
  );
}
