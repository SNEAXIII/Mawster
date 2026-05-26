'use client';

import { useState, type RefObject } from 'react';
import { useI18n } from '@/app/i18n';
import ChampionPortrait from '@/components/champion-portrait';
import PlayerFilterSelect from '@/app/game/_components/player-filter-select';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { type WarPlacement } from '@/app/services/war';
import { useWar } from '@/app/contexts/war-context';
import PrefightEntryRow from './prefight-entry-row';
import AssistAssignmentRow from './assist-assignment-row';
import { WarMode } from './war-types';
import AttackerEntryRow from './attacker-entry-row';
import SynergyPopover from './synergy-popover';
import MasteryDialog from '@/app/game/account/_components/mastery-dialog';
import { Swords } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { fightStateFilter } from './war-tab';
import ExportHeader from '@/app/game/_components/export-header';

interface MemberGroup {
  pseudo: string;
  entries: WarPlacement[];
}

interface WarAttackerPanelProps {
  playerFilter: string;
  onPlayerChange: (v: string) => void;
  combatFilter: fightStateFilter;
  onCombatFilterChange: (v: fightStateFilter) => void;
  exporting?: boolean;
  exportRef?: RefObject<HTMLDivElement | null>;
}

export default function WarAttackerPanel({
  playerFilter,
  onPlayerChange,
  combatFilter,
  onCombatFilterChange,
  exporting = false,
  exportRef,
}: Readonly<WarAttackerPanelProps>) {
  const { t } = useI18n();
  const {
    placements,
    warMode,
    synergies,
    prefights,
    isVisitor,
    selectedBg,
    alliances,
    selectedAllianceId,
    currentWar,
  } = useWar();
  const selectedAlliance = alliances.find((a) => a.id === selectedAllianceId) ?? null;
  const [masteryTarget, setMasteryTarget] = useState<{
    gameAccountId: string;
    pseudo: string;
  } | null>(null);

  const assigned = placements.filter((p) => p.attacker_champion_user_id !== null);

  // Group by attacker member (node attackers)
  const groupMap = new Map<string, MemberGroup>();
  for (const p of assigned) {
    const pseudo = p.attacker_pseudo ?? '?';
    if (!groupMap.has(pseudo)) {
      groupMap.set(pseudo, { pseudo, entries: [] });
    }
    groupMap.get(pseudo)!.entries.push(p);
  }
  // Also include prefight-only providers (no node assignments)
  for (const pf of prefights) {
    if (!groupMap.has(pf.game_pseudo)) {
      groupMap.set(pf.game_pseudo, { pseudo: pf.game_pseudo, entries: [] });
    }
  }
  // Build assist assignments grouped by assistor pseudo
  const assistsByPseudo = new Map<string, WarPlacement[]>();
  for (const p of placements) {
    if (p.is_assisted && p.assistor_pseudo) {
      if (!assistsByPseudo.has(p.assistor_pseudo)) assistsByPseudo.set(p.assistor_pseudo, []);
      assistsByPseudo.get(p.assistor_pseudo)!.push(p);
    }
  }
  // Include assistor-only members in the group map
  for (const [pseudo] of assistsByPseudo) {
    if (!groupMap.has(pseudo)) groupMap.set(pseudo, { pseudo, entries: [] });
  }

  const players = [
    ...new Set([
      ...(placements.map((p) => p.attacker_pseudo).filter(Boolean) as string[]),
      ...(placements.filter((p) => p.assistor_pseudo).map((p) => p.assistor_pseudo) as string[]),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const groups = Array.from(groupMap.values()).sort((a, b) =>
    exporting ? b.entries.length - a.entries.length : a.pseudo.localeCompare(b.pseudo)
  );

  return (
    <div
      ref={exportRef}
      className={cn('flex flex-col gap-3', exporting ? 'p-2 bg-black' : 'min-h-0 flex-1')}
      data-cy='war-attacker-panel'
    >
      {exporting && selectedAlliance && (
        <ExportHeader
          allianceTag={selectedAlliance.tag}
          allianceName={selectedAlliance.name}
          modeLabel={t.game.war.modeAttackers}
          bg={selectedBg}
          opponentName={currentWar?.opponent_name}
        />
      )}
      {!exporting && (
        <div className='flex items-center justify-between gap-2 px-1 shrink-0'>
          <span
            data-cy='attackers-count'
            className={`text-xs font-semibold uppercase tracking-wide ${
              assigned.length >= 50 ? 'text-yellow-400' : 'text-destructive'
            }`}
          >
            {t.game.war.attackersPanelTitle.replace('{assigned}', String(assigned.length))}
          </span>
          <div className='flex items-center gap-1'>
            <Select
              value={combatFilter}
              onValueChange={(v) => onCombatFilterChange(v as fightStateFilter)}
            >
              <SelectTrigger
                className='h-7 w-20 text-xs'
                data-cy='war-combat-filter'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='todo'>{t.game.war.combatFilterTodo}</SelectItem>
                <SelectItem value='done'>{t.game.war.combatFilterDone}</SelectItem>
                <SelectItem value='all'>{t.game.war.combatFilterAll}</SelectItem>
              </SelectContent>
            </Select>
            <PlayerFilterSelect
              players={players}
              value={playerFilter}
              onChange={onPlayerChange}
              dataCy='war-player-filter'
            />
          </div>
        </div>
      )}

      {assigned.length === 0 ? (
        <div className='text-sm text-muted-foreground px-1'>{t.game.war.noAvailableAttackers}</div>
      ) : (
        <div
          className={cn(
            'flex gap-4',
            exporting ? 'flex-row flex-wrap' : 'flex-col overflow-y-auto min-h-0'
          )}
        >
          {groups.map((memberGroup) => {
            // Node attacker unique champion_user_ids for this member
            const nodeAttackerIds = new Set(
              memberGroup.entries
                .map((e) => e.attacker_champion_user_id)
                .filter(Boolean) as string[]
            );

            // Synergy champions for this member (by pseudo match)
            const memberSynergies = synergies.filter((s) => s.game_pseudo === memberGroup.pseudo);
            const synergyOnlyProviders = memberSynergies.filter(
              (s) => !nodeAttackerIds.has(s.champion_user_id)
            );

            const memberPrefights = prefights.filter((p) => p.game_pseudo === memberGroup.pseudo);
            const memberAssists = assistsByPseudo.get(memberGroup.pseudo) ?? [];

            const prefightOnlyProviders = [
              ...new Map(
                memberPrefights
                  .filter((p) => !nodeAttackerIds.has(p.champion_user_id))
                  .map((p) => [p.champion_user_id, p])
              ).values(),
            ];
            const totalSlots = new Set([
              ...nodeAttackerIds,
              ...memberSynergies.map((s) => s.champion_user_id),
              ...memberPrefights.map((p) => p.champion_user_id),
              ...memberAssists.map((a) => a.assistor_champion_user_id).filter(Boolean),
            ]).size;

            // Deduplicated node attacker portraits (unique by champion_user_id)
            const nodePortraits = memberGroup.entries.filter(
              (p, i, arr) =>
                arr.findIndex(
                  (q) => q.attacker_champion_user_id === p.attacker_champion_user_id
                ) === i
            );

            if (playerFilter && memberGroup.pseudo !== playerFilter) return null;

            return (
              <div key={memberGroup.pseudo}>
                {/* Member header: pseudo + slot count + portrait row */}
                <div
                  className='flex items-center gap-1.5 mb-1.5 px-1'
                  data-cy={`attacker-member-${memberGroup.pseudo}`}
                >
                  <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                    {memberGroup.pseudo}
                  </span>
                  <span className='text-primary font-bold text-xs'>
                    {t.game.war.memberAttackers.replace('{count}', String(totalSlots))}
                  </span>
                  {!exporting && memberGroup.entries[0]?.attacker_game_account_id && (
                    <button
                      onClick={() =>
                        setMasteryTarget({
                          gameAccountId: memberGroup.entries[0].attacker_game_account_id!,
                          pseudo: memberGroup.pseudo,
                        })
                      }
                      className='text-muted-foreground hover:text-foreground transition-colors ml-auto'
                      title={t.mastery.title}
                    >
                      <Swords size={13} />
                    </button>
                  )}

                  {/* 3-slot portrait row: node attackers (clickable for synergy) + synergy-only */}
                  <div className='flex items-center gap-0.5 ml-1'>
                    {nodePortraits.map((placement) =>
                      warMode === WarMode.Attackers ? (
                        <SynergyPopover
                          key={placement.attacker_champion_user_id}
                          championUserId={placement.attacker_champion_user_id!}
                          gameAccountId={placement.attacker_game_account_id ?? ''}
                          championName={placement.attacker_champion_name ?? ''}
                          imageUrl={placement.attacker_image_url}
                          rarity={placement.attacker_rarity ?? ''}
                          size={35}
                          isPreferred={placement.attacker_is_preferred_attacker ?? false}
                          ascension={placement.attacker_ascension ?? 0}
                          is_saga_attacker={placement.attacker_is_saga_attacker ?? false}
                          is_saga_defender={placement.attacker_is_saga_defender ?? false}
                          canManage={!isVisitor}
                        />
                      ) : (
                        <ChampionPortrait
                          key={placement.attacker_champion_user_id}
                          imageUrl={placement.attacker_image_url}
                          name={placement.attacker_champion_name ?? ''}
                          rarity={placement.attacker_rarity ?? ''}
                          size={35}
                          isPreferred={placement.attacker_is_preferred_attacker ?? false}
                          ascension={placement.attacker_ascension ?? 0}
                          is_saga_attacker={placement.attacker_is_saga_attacker ?? false}
                          is_saga_defender={placement.attacker_is_saga_defender ?? false}
                          sagaMode='attacker'
                        />
                      )
                    )}

                    {/* Synergy-only champions (not on any node) */}
                    {synergyOnlyProviders.map((s) => (
                      <ChampionPortrait
                        key={s.champion_user_id}
                        imageUrl={s.image_url}
                        name={s.champion_name}
                        rarity={s.rarity}
                        size={35}
                        mode='synergy'
                        ascension={s.ascension}
                        is_saga_attacker={s.is_saga_attacker}
                        is_saga_defender={s.is_saga_defender}
                        sagaMode='attacker'
                      />
                    ))}

                    {/* Prefight-only champions */}
                    {prefightOnlyProviders.map((p) => (
                      <ChampionPortrait
                        key={p.champion_user_id}
                        imageUrl={p.image_url}
                        name={p.champion_name}
                        rarity={p.rarity}
                        size={35}
                        mode='prefight'
                        ascension={p.ascension}
                        is_saga_attacker={p.is_saga_attacker}
                        is_saga_defender={p.is_saga_defender}
                        sagaMode='attacker'
                      />
                    ))}
                  </div>
                </div>

                {/* Per-node entries */}
                <div className='flex flex-col gap-1.5'>
                  {[...memberGroup.entries]
                    .sort((a, b) => a.node_number - b.node_number)
                    .map((placement) => (
                      <div
                        key={placement.id}
                        className={cn(
                          combatFilter === 'todo' && placement.is_combat_completed && 'opacity-60',
                          combatFilter === 'done' && !placement.is_combat_completed && 'opacity-60'
                        )}
                      >
                        <AttackerEntryRow
                          placement={placement}
                          readonly={warMode !== WarMode.Attackers}
                        />
                      </div>
                    ))}
                  {/* Prefight entries for this member */}
                  {memberPrefights.map((pf) => (
                    <PrefightEntryRow
                      key={pf.id}
                      prefight={pf}
                      targetPlacement={placements.find(
                        (p) => p.node_number === pf.target_node_number
                      )}
                      readonly={warMode !== WarMode.Attackers}
                    />
                  ))}
                  {/* Assist assignment entries for this member */}
                  {memberAssists.map((p) => (
                    <AssistAssignmentRow
                      key={`assist-${p.node_number}`}
                      placement={p}
                      readonly={warMode !== WarMode.Attackers}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {masteryTarget && (
        <MasteryDialog
          open={!!masteryTarget}
          onOpenChange={(open) => {
            if (!open) setMasteryTarget(null);
          }}
          gameAccountId={masteryTarget.gameAccountId}
          pseudo={masteryTarget.pseudo}
          defaultMode='offense'
        />
      )}
    </div>
  );
}
