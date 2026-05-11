'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector';

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
            <span className="flex items-center gap-1.5">
              {a.isVisitor && (
                <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label={t.game.war.viewOnly} data-cy="visitor-eye-icon" />
              )}
              [{a.tag}] {a.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
