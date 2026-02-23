'use client';

import React from 'react';
import { getChampionImageUrl } from '@/app/services/champions';
import { getStarFrameUrl } from '@/app/services/roster';

interface ChampionPortraitProps {
  imageUrl: string | null;
  name: string;
  rarity: string;
  /** Outer size in px (default 56) */
  size?: number;
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
}: ChampionPortraitProps) {
  const frameUrl = getStarFrameUrl(rarity);
  const imgSize = 40; // pre-resized thumbnails

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Star frame – behind */}
      <img
        src={frameUrl}
        alt=""
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />
      {/* Champion image – on top */}
      {imageUrl ? (
        <img
          src={getChampionImageUrl(imageUrl, imgSize) ?? ''}
          alt={name}
          className="absolute inset-[6px] w-[calc(100%-12px)] h-[calc(100%-12px)] object-cover z-10"
        />
      ) : (
        <div className="absolute inset-[6px] w-[calc(100%-12px)] h-[calc(100%-12px)] bg-gray-700 flex items-center justify-center text-gray-400 text-xs z-10">
          ?
        </div>
      )}
    </div>
  );
}
