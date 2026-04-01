'use client';

import { useI18n } from '@/app/i18n';
import ChampionPortrait from '@/components/champion-portrait';
import { type WarPlacement } from '@/app/services/war';
import { useWar } from '../_context/war-context';
import AttackerEntryRow from './attacker-entry-row';

interface MemberGroup {
  pseudo: string;
  entries: WarPlacement[];
}

export default function WarAttackerPanel() {
  const { t } = useI18n();
  const { placements } = useWar();

  const assigned = placements.filter((p) => p.attacker_champion_user_id !== null);

  // Group by attacker member
  const groupMap = new Map<string, MemberGroup>();
  for (const p of assigned) {
    const pseudo = p.attacker_pseudo ?? '?';
    if (!groupMap.has(pseudo)) {
      groupMap.set(pseudo, { pseudo, entries: [] });
    }
    groupMap.get(pseudo)!.entries.push(p);
  }
  const groups = Array.from(groupMap.values()).sort((a, b) => a.pseudo.localeCompare(b.pseudo));

  return (
    <div
      className='flex flex-col gap-3 min-h-0 flex-1'
      data-cy='war-attacker-panel'
    >
      <div className='text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1 shrink-0'>
        {t.game.war.attackersPanelTitle.replace('{assigned}', String(assigned.length))}
      </div>

      {assigned.length === 0 ? (
        <div className='text-sm text-muted-foreground px-1'>{t.game.war.noAvailableAttackers}</div>
      ) : (
        <div className='space-y-4 overflow-y-auto min-h-0'>
          {groups.map((group) => (
            <div key={group.pseudo}>
              {/* Member header: pseudo + count + attacker portraits */}
              <div className='flex items-center gap-1.5 mb-1.5 px-1'>
                <span className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                  {group.pseudo}
                </span>
                <span className='text-primary font-bold text-xs'>
                  {t.game.war.memberAttackers.replace(
                    '{count}',
                    String(new Set(group.entries.map((e) => e.attacker_champion_user_id)).size)
                  )}
                </span>
                <div className='flex items-center gap-0.5 ml-1'>
                  {group.entries
                    .filter(
                      (placement, i, arr) =>
                        arr.findIndex(
                          (q) => q.attacker_champion_name === placement.attacker_champion_name
                        ) === i
                    )
                    .map((placement) => (
                      <ChampionPortrait
                        key={placement.id}
                        imageUrl={placement.attacker_image_url}
                        name={placement.attacker_champion_name ?? ''}
                        rarity={placement.attacker_rarity ?? '7r3'}
                        size={35}
                      />
                    ))}
                </div>
              </div>

              {/* Per-node entries */}
              <div className='space-y-1.5'>
                {[...group.entries]
                  .sort((a, b) => a.node_number - b.node_number)
                  .map((placement) => (
                    <AttackerEntryRow
                      key={placement.id}
                      placement={placement}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
