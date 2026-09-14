'use client'

import { useI18n } from '@/app/i18n'
import { CollapsibleSection } from '@/components/collapsible-section'
import { useMatchupsViewModel } from '../_viewmodels/use-matchups-viewmodel'
import MatchupEvaluationFilters from './matchup-evaluation-filters'
import MatchupEvaluationTable from './matchup-evaluation-table'
import MatchupForm from './matchup-form'
import MatchupGridTable from './matchup-grid-table'
import MatchupDefenderGridTable from './matchup-defender-grid-table'
import MatchupTable from './matchup-table'

export default function MatchupsTab() {
  const { t } = useI18n()
  const vm = useMatchupsViewModel()
  const { pseudoToAccountId, players, selectedPseudo } = vm

  return (
    <div
      className='flex flex-col gap-4'
      data-cy='matchups-tab'
    >
      {vm.canEdit && (
        <CollapsibleSection
          title={t.game.knowledgeBase.addSectionTitle}
          defaultOpen={false}
        >
          <div className='flex flex-col gap-4'>
            <MatchupForm
              onSubmit={vm.saveMatchup}
              attackerId={vm.matchupAttackerId}
              onAttackerChange={vm.setMatchupAttackerId}
            />
            <MatchupTable
              ratings={vm.similarRatings}
              attackerId={vm.matchupAttackerId}
              onDelete={vm.removeMatchup}
            />
          </div>
        </CollapsibleSection>
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
      {vm.showGrid && (
        <MatchupGridTable
          grid={vm.grid}
          loading={vm.loading}
        />
      )}
      {vm.showDefenderGrid && (
        <MatchupDefenderGridTable
          grid={vm.defenderGrid}
          loading={vm.loading}
        />
      )}
      {!vm.showGrid && !vm.showDefenderGrid && !vm.hasTarget && (
        <p
          className='text-muted-foreground text-sm'
          data-cy='matchup-hint'
        >
          {t.game.knowledgeBase.selectTargetHint}
        </p>
      )}
      {!vm.showGrid && !vm.showDefenderGrid && vm.hasTarget && (
        <MatchupEvaluationTable
          rows={vm.rows}
          loading={vm.loading}
        />
      )}
    </div>
  )
}
