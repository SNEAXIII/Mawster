'use client';

import { useMemo } from 'react';
import { type DefensePlacement } from '@/app/services/defense';
import { WarMapNode, WarMapPlaceHolder } from './war-map';

interface BigThingWarMapProps {
  placements: DefensePlacement[];
  onNodeClick: (nodeNumber: number) => void;
  onRemove: (nodeNumber: number) => void;
  canManage: boolean;
  hidePseudo?: boolean;
  hideSig?: boolean;
  dimmedNodes?: Set<number>;
  prefightNodes?: Set<number>;
}

// Big Thing war layout: 10 nodes, 3 rows (top to bottom)
// Row 1: boss row        [9, 10]
// Row 2: mini boss row   [5, 6, gap, 7, 8]
// Row 3: start row       [1, 2, gap, 3, 4]
const BT_ROWS = [
  [9, 10],
  [5, 6, 0, 7, 8],
  [1, 2, 0, 3, 4],
];

function getBtNodeColor(nodeNumber: number): string {
  if (nodeNumber >= 9) return 'border-yellow-500 bg-yellow-950/40';
  if (nodeNumber >= 5) return 'border-blue-500 bg-blue-950/40';
  return 'border-red-500 bg-red-950/40';
}

export default function BigThingWarMap({
  placements,
  onNodeClick,
  onRemove,
  canManage,
  hidePseudo = false,
  hideSig = false,
  dimmedNodes,
  prefightNodes,
}: Readonly<BigThingWarMapProps>) {
  const placementMap = useMemo(() => {
    const map = new Map<number, DefensePlacement>();
    for (const p of placements) map.set(p.node_number, p);
    return map;
  }, [placements]);

  return (
    <div className='flex flex-col items-center gap-3 py-4'>
      {BT_ROWS.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className='flex gap-2 justify-center'
        >
          {row.map((nodeNumber, colIdx) =>
            nodeNumber === 0 ? (
              <WarMapPlaceHolder key={`gap-${rowIdx}-${colIdx}`} />
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
  );
}
