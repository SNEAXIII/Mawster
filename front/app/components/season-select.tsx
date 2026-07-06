'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SeasonSelectProps {
  seasons: { id: string; number: number }[];
  value: string | null;
  onChange: (seasonId: string) => void;
  placeholder: string;
  getLabel: (season: { id: string; number: number }) => string;
  className?: string;
  'data-cy'?: string;
}

export default function SeasonSelect({
  seasons,
  value,
  onChange,
  placeholder,
  getLabel,
  className = 'w-36',
  'data-cy': dataCy,
}: SeasonSelectProps) {
  return (
    <Select
      value={value ?? ''}
      onValueChange={(v) => v && onChange(v)}
      data-cy={dataCy}
    >
      <SelectTrigger
        className={className}
        data-cy={dataCy ? `${dataCy}-trigger` : undefined}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {seasons.map((s) => (
          <SelectItem
            key={s.id}
            value={s.id}
          >
            {getLabel(s)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
