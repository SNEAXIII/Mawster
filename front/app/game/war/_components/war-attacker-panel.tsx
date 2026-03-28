'use client';

import { useI18n } from '@/app/i18n';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { X, Minus, Plus, Swords } from 'lucide-react';
import { type WarPlacement } from '@/app/services/war';
import { useWar } from '../_context/war-context';

interface MemberGroup {
  pseudo: string;
  entries: WarPlacement[];
}

export default function WarAttackerPanel() {
  const { t } = useI18n();
  const { placements, handleRemoveAttacker, handleUpdateKo } = useWar();

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
      className='flex flex-col gap-3'
      data-cy='war-attacker-panel'
    >
      <div className='text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1'>
        {t.game.war.attackersPanelTitle.replace('{assigned}', String(assigned.length))}
      </div>

      {assigned.length === 0 ? (
        <div className='text-sm text-muted-foreground px-1'>{t.game.war.noAvailableAttackers}</div>
      ) : (
        <div className='space-y-4'>
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
                      (p, i, arr) =>
                        arr.findIndex(
                          (q) => q.attacker_champion_name === p.attacker_champion_name
                        ) === i
                    )
                    .map((p) => (
                      <ChampionPortrait
                        key={p.id}
                        imageUrl={p.attacker_image_url}
                        name={p.attacker_champion_name ?? ''}
                        rarity={p.attacker_rarity ?? '7r3'}
                        size={35}
                      />
                    ))}
                </div>
              </div>

              {/* Per-node entries */}
              <div className='space-y-1.5'>
                {[...group.entries]
                  .sort((a, b) => a.node_number - b.node_number)
                  .map((p) => (
                    <div
                      key={p.id}
                      className='flex items-center gap-2 rounded-md border bg-card px-2 py-1.5'
                      data-cy={`attacker-entry-node-${p.node_number}`}
                    >
                      {/* Attacker vs Defender portraits */}
                      <div className='flex items-center gap-1 flex-shrink-0'>
                        <ChampionPortrait
                          imageUrl={p.attacker_image_url}
                          name={p.attacker_champion_name ?? ''}
                          rarity={p.attacker_rarity ?? '7r3'}
                          size={35}
                        />
                        <Swords className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                        <ChampionPortrait
                          imageUrl={p.image_url}
                          name={p.champion_name}
                          rarity={p.rarity}
                          size={35}
                        />
                      </div>

                      <div className='flex-1 min-w-0'>
                        <div className='text-[10px] text-muted-foreground'>#{p.node_number}</div>
                      </div>

                      {/* KO counter */}
                      <div
                        className='flex items-center gap-1'
                        data-cy={`ko-counter-node-${p.node_number}`}
                      >
                        <button
                          type='button'
                          className={cn(
                            'w-5 h-5 rounded flex items-center justify-center text-xs',
                            'bg-muted hover:bg-accent transition-colors',
                            p.ko_count <= 0 && 'opacity-40 cursor-not-allowed'
                          )}
                          onClick={() =>
                            p.ko_count > 0 && handleUpdateKo(p.node_number, p.ko_count - 1)
                          }
                          disabled={p.ko_count <= 0}
                          data-cy={`ko-dec-node-${p.node_number}`}
                        >
                          <Minus className='w-2.5 h-2.5' />
                        </button>
                        <span
                          className='text-xs font-mono w-4 text-center'
                          data-cy={`ko-value-node-${p.node_number}`}
                        >
                          {p.ko_count}
                        </span>
                        <button
                          type='button'
                          className='w-5 h-5 rounded flex items-center justify-center text-xs bg-muted hover:bg-accent transition-colors'
                          onClick={() => handleUpdateKo(p.node_number, p.ko_count + 1)}
                          data-cy={`ko-inc-node-${p.node_number}`}
                        >
                          <Plus className='w-2.5 h-2.5' />
                        </button>
                      </div>

                      {/* Remove attacker */}
                      <button
                        type='button'
                        className='w-5 h-5 rounded-full bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center flex-shrink-0'
                        onClick={() => handleRemoveAttacker(p.node_number)}
                        title={t.game.war.removeAttacker}
                        data-cy={`remove-attacker-node-${p.node_number}`}
                      >
                        <X className='w-2.5 h-2.5' />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
