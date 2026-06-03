'use client';

import { type DefensePlacement } from '@/app/services/defense';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { X } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { rarityBadgeClass, rarityLabel, parseRarity } from './defense-utils';
import { mapSectionsForFormat } from './war-format';
import type { SeasonFormat } from '@/app/services/season';

interface WarMapNodeProps {
  nodeNumber: number;
  placement: DefensePlacement | null;
  onNodeClick: (nodeNumber: number) => void;
  onRemove: (nodeNumber: number) => void;
  canManage: boolean;
  hidePseudo?: boolean;
  hideSig?: boolean;
  dimmed?: boolean;
  hasPrefight?: boolean;
}

function getNodeColor(nodeNumber: number): string {
  if (nodeNumber >= 46) return 'border-yellow-500 bg-yellow-950/40';
  if (nodeNumber >= 37) return 'border-blue-500 bg-blue-950/40';
  if (nodeNumber >= 19) return 'border-purple-500 bg-purple-950/40';
  return 'border-red-500 bg-red-950/40';
}

function getNodeHoverColor(nodeNumber: number): string {
  if (nodeNumber >= 46) return 'hover:bg-yellow-900/60';
  if (nodeNumber >= 37) return 'hover:bg-blue-900/60';
  if (nodeNumber >= 19) return 'hover:bg-purple-900/60';
  return 'hover:bg-red-900/60';
}

export function WarMapPlaceHolder() {
  return <div className='w-3'></div>;
}
export function WarMapNode({
  nodeNumber,
  placement,
  onNodeClick,
  onRemove,
  canManage,
  hidePseudo = false,
  hideSig = false,
  dimmed = false,
  hasPrefight = false,
}: Readonly<WarMapNodeProps>) {
  const { t } = useI18n();
  const colorClasses = getNodeColor(nodeNumber);
  const hoverClasses = getNodeHoverColor(nodeNumber);

  return (
    <div
      role='button'
      tabIndex={0}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 cursor-pointer transition-all',
        'w-17 h-20.5',
        colorClasses,
        hoverClasses,
        hasPrefight && 'ring-2 ring-foreground',
        !hasPrefight && !dimmed && placement && 'ring-1 ring-white/30',
        !dimmed && !placement && 'opacity-80',
        dimmed && 'opacity-25'
      )}
      onClick={() => onNodeClick(nodeNumber)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNodeClick(nodeNumber); }}
      title={
        placement
          ? `#${nodeNumber} – ${placement.champion_name} (${placement.game_pseudo})`
          : t.game.defense.nodeEmpty.replace('{node}', String(nodeNumber))
      }
      data-cy={`war-node-${nodeNumber}`}
    >
      {/* Node number badge */}
      <span className='absolute -top-2 -left-1 text-[10px] font-bold bg-black/70 text-white rounded px-1 z-20'>
        {nodeNumber}
      </span>

      {/* Remove button */}
      {placement && canManage && (
        <button
          className='absolute -top-2 -right-2 z-30 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center'
          onClick={(e) => {
            e.stopPropagation();
            onRemove(nodeNumber);
          }}
          title={t.game.defense.removeDefender}
        >
          <X className='w-3 h-3' />
        </button>
      )}
      {placement ? (
        <div className='flex flex-col items-center gap-0.5'>
          <ChampionPortrait
            imageUrl={placement.champion_image_url}
            name={placement.champion_name}
            rarity={placement.rarity}
            size={45}
            isPreferred={placement.is_preferred_attacker}
            ascension={placement.ascension}
            is_saga_attacker={placement.is_saga_attacker}
            is_saga_defender={placement.is_saga_defender}
            sagaMode='defender'
          />
          <span
            className={cn(
              'text-[10px] font-medium leading-none',
              rarityBadgeClass(placement.rarity)
            )}
          >
            {hideSig
              ? (() => {
                  const { stars, rank } = parseRarity(placement.rarity);
                  const parts = [`${stars}R${rank}`];
                  if (placement.ascension > 0) parts.push(`A${placement.ascension}`);
                  return parts.join('·');
                })()
              : rarityLabel(placement.rarity, placement.signature, placement.ascension)}
          </span>
          {!hidePseudo && placement.game_pseudo && (
            <span className='text-[9px] text-white/80 truncate max-w-14 sm:max-w-16 text-center leading-tight'>
              {placement.game_pseudo}
            </span>
          )}
        </div>
      ) : (
        <span className='text-white/40 text-xs'>+</span>
      )}
    </div>
  );
}

// ─── War Map Grid ────────────────────────────────────────

interface WarMapProps {
  placements: DefensePlacement[];
  onNodeClick: (nodeNumber: number) => void;
  onRemove: (nodeNumber: number) => void;
  canManage: boolean;
  hidePseudo?: boolean;
  hideSig?: boolean;
  dimmedNodes?: Set<number>;
  prefightNodes?: Set<number>;
  format?: SeasonFormat;
}

export default function WarMap({
  placements,
  onNodeClick,
  onRemove,
  canManage,
  hidePseudo = false,
  hideSig = false,
  dimmedNodes,
  prefightNodes,
  format = 'regular',
}: Readonly<WarMapProps>) {
  const sections = mapSectionsForFormat(format);
  const placementMap = new Map<number, DefensePlacement>();
  for (const p of placements) {
    placementMap.set(p.node_number, p);
  }

  return (
    <div className='flex flex-col items-center gap-1'>
      {sections.map((section) => (
        <div
          key={section.label}
          className='flex flex-col items-center gap-1 w-full'
        >
          {/* Section label */}
          <div
            className={cn('text-xs font-bold uppercase tracking-wider mt-2 mb-1', section.color)}
          >
            {section.label}
          </div>
          <div className={cn('border-t w-3/4 mb-2', section.borderColor)} />

          {section.rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className='flex gap-1 justify-center'
            >
              {row.map((nodeNumber, index) =>
                nodeNumber === 0 ? (
                  <WarMapPlaceHolder key={`${rowIdx}-${index}`} />
                ) : (
                  <WarMapNode
                    key={nodeNumber}
                    nodeNumber={nodeNumber}
                    placement={placementMap.get(nodeNumber) ?? null}
                    onNodeClick={onNodeClick}
                    onRemove={onRemove}
                    canManage={canManage}
                    hidePseudo={hidePseudo}
                    hideSig={hideSig}
                    dimmed={dimmedNodes?.has(nodeNumber) ?? false}
                    hasPrefight={prefightNodes?.has(nodeNumber) ?? false}
                  />
                )
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
