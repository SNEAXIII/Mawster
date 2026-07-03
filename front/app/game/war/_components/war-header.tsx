'use client';

import { useI18n } from '@/app/i18n';
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector';
import AllianceSelect from '@/app/game/_components/alliance-select';

interface WarHeaderProps {
  alliances: AllianceWithVisitorFlag[];
  selectedAllianceId: string;
  onAllianceChange: (id: string) => void;
}

export default function WarHeader({
  alliances,
  selectedAllianceId,
  onAllianceChange,
}: Readonly<WarHeaderProps>) {
  const { t } = useI18n();

  if (alliances.length <= 1) return null;

  return (
    <AllianceSelect
      alliances={alliances}
      value={selectedAllianceId}
      onChange={onAllianceChange}
      triggerClassName='w-48'
      dataCy='alliance-select'
      placeholder={t.game.defense.alliance}
    />
  );
}
