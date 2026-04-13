'use client';

import dynamic from 'next/dynamic';
import { FullPageSpinner } from '@/components/full-page-spinner';
import { type WarPlacement } from '@/app/services/war';
import { type DefensePlacement } from '@/app/services/defense';

const WarMap = dynamic(() => import('@/app/game/defense/_components/war-map'), {
  loading: () => <FullPageSpinner />,
});

interface WarDefenseMapProps {
  placements: WarPlacement[];
  onNodeClick: (nodeNumber: number) => void;
  onRemove: (nodeNumber: number) => void;
  canManage: boolean;
}

function toDefensePlacement(p: WarPlacement): DefensePlacement {
  return {
    id: p.id,
    alliance_id: '',
    battlegroup: p.battlegroup,
    node_number: p.node_number,
    champion_user_id: '',
    game_account_id: '',
    game_pseudo: p.attacker_pseudo ?? '',
    champion_name: p.champion_name,
    champion_alias: null,
    champion_class: p.champion_class,
    champion_image_url: p.image_url,
    rarity: p.rarity,
    signature: 0,
    is_preferred_attacker: false,
    ascension: p.ascension,
    is_saga_attacker: p.is_saga_attacker,
    is_saga_defender: p.is_saga_defender,
    placed_by_id: null,
    placed_by_pseudo: p.placed_by_pseudo,
    created_at: p.created_at,
  };
}

export default function WarDefenseMap({
  placements,
  onNodeClick,
  onRemove,
  canManage,
}: Readonly<WarDefenseMapProps>) {
  const adapted = placements.map(toDefensePlacement);
  return (
    <WarMap
      placements={adapted}
      onNodeClick={onNodeClick}
      onRemove={onRemove}
      canManage={canManage}
      hidePseudo={false}
      hideSig={true}
    />
  );
}
