'use client';

import { useState } from 'react';
import { useI18n } from '@/app/i18n';
import { MasteryEntry } from '@/app/services/masteries';

export type MasteryMode = 'all' | 'offense' | 'defense';

interface MasteryMiniViewProps {
  masteries: MasteryEntry[];
  defaultMode?: MasteryMode;
}

function valueColor(value: number, max: number) {
  if (max === 0 || value === 0) return 'text-muted-foreground';
  if (value >= max) return 'text-amber-400 font-semibold';
  return 'text-blue-400';
}

export default function MasteryMiniView({
  masteries,
  defaultMode = 'all',
}: Readonly<MasteryMiniViewProps>) {
  const { t } = useI18n();
  const [mode, setMode] = useState<MasteryMode>(defaultMode);

  const modes: MasteryMode[] = ['all', 'offense', 'defense'];

  if (masteries.length === 0) {
    return <p className='text-sm text-muted-foreground'>{t.mastery.noMasteries}</p>;
  }

  return (
    <div className='space-y-3'>
      {/* Mode tabs */}
      <div className='flex gap-1 bg-muted/40 rounded-lg p-1 w-fit'>
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-xs px-3 py-1 rounded-md capitalize transition-colors ${
              mode === m
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m === 'all'
              ? t.mastery.modeAll
              : m === 'offense'
                ? t.mastery.modeOffense
                : t.mastery.modeDefense}
          </button>
        ))}
      </div>

      {/* Mastery list */}
      <div className='space-y-1'>
        {masteries.map((m) => {
          const name =
            t.mastery.names[m.mastery_order as keyof typeof t.mastery.names] ?? m.mastery_name;
          return (
            <div
              key={m.mastery_id}
              className='flex items-center justify-between text-sm px-1'
            >
              <span className='text-xs uppercase tracking-wide text-muted-foreground w-40 truncate'>
                {name}
              </span>
              <div className='flex items-center gap-3 text-xs font-mono'>
                {mode == 'all' && (
                  <span className={valueColor(m.unlocked, m.mastery_max_value)}>
                    {m.unlocked}/{m.mastery_max_value}
                  </span>
                )}
                {mode !== 'defense' && (
                  <span className={`${valueColor(m.attack, m.unlocked)}`}>
                    {mode == 'all' && t.mastery.attack[0]}
                    {m.attack}
                    {mode !== 'all' && '/' + m.unlocked}
                  </span>
                )}
                {mode !== 'offense' && (
                  <span className={`${valueColor(m.defense, m.unlocked)}`}>
                    {mode == 'all' && t.mastery.defense[0]}
                    {m.defense}
                    {mode !== 'all' && '/' + m.unlocked}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
