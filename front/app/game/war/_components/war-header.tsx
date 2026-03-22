'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/app/i18n';
import type { Alliance } from '@/app/services/game';

interface WarHeaderProps {
  alliances: Alliance[];
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
    <Select
      value={selectedAllianceId}
      onValueChange={onAllianceChange}
    >
      <SelectTrigger
        className='w-48'
        data-cy='alliance-select'
      >
        <SelectValue placeholder={t.game.defense.alliance} />
      </SelectTrigger>
      <SelectContent>
        {alliances.map((a) => (
          <SelectItem
            key={a.id}
            value={a.id}
          >
            [{a.tag}] {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
