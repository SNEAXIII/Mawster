'use client';

import { type DefensePlacement } from '@/app/services/defense';
import ChampionPortrait from '@/components/champion-portrait';
import { cn } from '@/app/lib/utils';
import { X } from 'lucide-react';
import { useI18n } from '@/app/i18n';

interface WarMapNodeProps {
  nodeNumber: number;
  placement: DefensePlacement | null;
  onNodeClick: (nodeNumber: number) => void;
  onRemove: (nodeNumber: number) => void;
  canManage: boolean;
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

function getSectionLabel(nodeNumber: number): string {
  if (nodeNumber >= 46) return 'Boss';
  if (nodeNumber >= 37) return 'Blue';
  if (nodeNumber >= 19) return 'Purple';
  return 'Red';
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
}: WarMapNodeProps) {
  const colorClasses = getNodeColor(nodeNumber);
  const hoverClasses = getNodeHoverColor(nodeNumber);

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 cursor-pointer transition-all',
        'w-[72px] h-[84px] sm:w-[80px] sm:h-[92px]',
        colorClasses,
        hoverClasses,
        placement ? 'ring-1 ring-white/30' : 'opacity-80'
      )}
      onClick={() => onNodeClick(nodeNumber)}
      title={
        placement
          ? `#${nodeNumber} – ${placement.champion_name} (${placement.game_pseudo})`
          : `Node #${nodeNumber} – Empty`
      }
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
          title='Remove defender'
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
            size={44}
          />
          <span className='text-[9px] text-white/80 truncate max-w-[68px] text-center leading-tight'>
            {placement.game_pseudo}
          </span>
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
}

// Map layout: rows of nodes from top (boss) to bottom (start)
// This mimics the AW defense map layout
const MAP_SECTIONS = [
  {
    label: 'Boss',
    color: 'text-yellow-400',
    borderColor: 'border-yellow-600',
    rows: [[50], [48, 49], [46, 47]],
  },
  {
    label: 'Mini Boss',
    color: 'text-blue-400',
    borderColor: 'border-blue-600',
    rows: [
      [43, 44, 45],
      [40, 41, 42, 0, 37, 38, 39],
    ],
  },
  {
    label: 'Tier 2',
    color: 'text-purple-400',
    borderColor: 'border-purple-600',
    rows: [
      [28, 29, 30, 0, 31, 32, 33, 0, 34, 35, 36],
      [19, 20, 21, 0, 22, 23, 24, 0, 25, 26, 27],
    ],
  },
  {
    label: 'Tier 1',
    color: 'text-red-400',
    borderColor: 'border-red-600',
    rows: [
      [10, 11, 12, 0, 13, 14, 15, 0, 16, 17, 18],
      [1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9],
    ],
  },
];

export default function WarMap({ placements, onNodeClick, onRemove, canManage }: WarMapProps) {
  const { t } = useI18n();
  const placementMap = new Map<number, DefensePlacement>();
  for (const p of placements) {
    placementMap.set(p.node_number, p);
  }

  return (
    <div className='flex flex-col items-center gap-1 py-4'>
      {MAP_SECTIONS.map((section) => (
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
              className='flex gap-1 sm:gap-2 justify-center'
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
