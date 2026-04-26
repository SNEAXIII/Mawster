'use client';

import React from 'react';
import { getChampionImageUrl } from '@/app/services/champions';
import { getStarFrameUrl } from '@/app/services/roster';
import SynergyBadge from '@/app/game/war/_components/synergy-badge';
import PrefightBadge from '@/app/game/war/_components/prefight-badge';
import PreferredBadge from '@/app/game/war/_components/preferred-badge';
import SagaBadge from '@/app/game/war/_components/saga-badge';
import AscensionBadge from '@/app/game/war/_components/ascension-badge';
import { cn } from '@/app/lib/utils';

type mode = 'normal' | 'synergy' | 'prefight';
type SagaMode = 'attacker' | 'defender' | 'all';

interface ChampionPortraitProps {
  imageUrl: string | null;
  name: string;
  rarity: string;
  /** Outer size in px (default 56) */
  size?: number;
  /** Optional badge rendered absolutely over the portrait (bottom-right) */
  mode?: mode;
  /** Star badge at top-left indicating a player's preferred attacker */
  isPreferred?: boolean;
  /** Whether champion is a saga attacker */
  is_saga_attacker?: boolean;
  /** Whether champion is a saga defender */
  is_saga_defender?: boolean;
  /**
   * Controls which saga flag triggers the "S" badge:
   * - 'attacker' — show if is_saga_attacker
   * - 'defender' — show if is_saga_defender
   * - 'all'      — show if either (default)
   */
  sagaMode?: SagaMode;
  /** Purple "A1"/"A2" badge at top-right for ascension level (0 = no badge) */
  ascension?: number;
  dataCy?: string;
}

/**
 * Champion portrait with the star frame behind the champion image.
 * The frame sits underneath; the champion image is on top without border-radius.
 */
export default function ChampionPortrait({
  imageUrl,
  name,
  rarity,
  size = 56,
  mode = 'normal',
  isPreferred = false,
  is_saga_attacker = false,
  is_saga_defender = false,
  sagaMode = 'all',
  ascension = 0,
  dataCy,
}: Readonly<ChampionPortraitProps>) {
  const showSaga =
    sagaMode === 'attacker'
      ? is_saga_attacker
      : sagaMode === 'defender'
        ? is_saga_defender
        : is_saga_attacker || is_saga_defender;
  const frameUrl = getStarFrameUrl(rarity);
  const imgSize = 60; // pre-resized thumbnails
  const baseClass = 'absolute inset-1.5 pb-0.75 w-[calc(100%-12px)] h-[calc(100%-12px)]';

  return (
    <div
      className='relative shrink-0'
      style={{ width: size, height: size }}
      data-cy={dataCy ?? `champion-portrait-${name}-${mode}`}
    >
      {/* Star frame – behind */}
      <img
        src={frameUrl}
        alt=''
        className='absolute inset-0 w-full h-full object-contain pointer-events-none'
      />
      {/* Champion image – on top, shifted slightly up */}
      {imageUrl ? (
        <img
          src={getChampionImageUrl(imageUrl, imgSize) ?? ''}
          alt={name}
          className={cn(baseClass, 'object-cover z-10')}
        />
      ) : (
        <div
          className={cn(
            baseClass,
            'bg-gray-700 flex items-center justify-center text-gray-400 text-xs z-10'
          )}
        >
          ?
        </div>
      )}
      {mode === 'synergy' && <SynergyBadge additionalClasses='z-30' />}
      {mode === 'prefight' && <PrefightBadge additionalClasses='z-30' />}
      {isPreferred && <PreferredBadge additionalClasses='z-30' />}
      {showSaga && (
        <SagaBadge
          additionalClasses='z-30'
          size={Number(size / 2.5)}
        />
      )}
      {(ascension === 1 || ascension === 2) && (
        <AscensionBadge
          additionalClasses='z-30'
          size={Number(size / 2.3)}
          level={ascension}
        />
      )}
    </div>
  );
}
