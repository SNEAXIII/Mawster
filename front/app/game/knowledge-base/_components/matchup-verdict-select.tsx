'use client'

import { useI18n } from '@/app/i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MatchupVerdict } from '@/app/services/matchups'

const VERDICTS: MatchupVerdict[] = ['discouraged', 'ok', 'good']

interface Props {
  value: MatchupVerdict
  onChange: (verdict: MatchupVerdict) => void
  'data-cy': string
}

export default function MatchupVerdictSelect({
  value,
  onChange,
  'data-cy': dataCy,
}: Readonly<Props>) {
  const { t } = useI18n()
  const kb = t.game.knowledgeBase

  const verdictLabel = (verdict: MatchupVerdict) =>
    verdict === 'discouraged'
      ? kb.verdictDiscouraged
      : verdict === 'good'
        ? kb.verdictGood
        : kb.verdictOk

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as MatchupVerdict)}
    >
      <SelectTrigger
        className='w-40'
        data-cy={dataCy}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VERDICTS.map((verdict) => (
          <SelectItem
            key={verdict}
            value={verdict}
            data-cy={`${dataCy}-${verdict}`}
          >
            {verdictLabel(verdict)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
