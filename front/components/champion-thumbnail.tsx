'use client'

import React from 'react'
import { getChampionImageUrl } from '@/app/services/champions'
import { cn } from '@/app/lib/utils'

interface ChampionThumbnailProps {
  imageUrl: string | null | undefined
  name: string
  /** Rendered square size in px (also the resolution requested). Default 32. */
  size?: number
  className?: string
}

// Small square champion portrait — the plain image, no star frame or badges
// (that is ChampionPortrait's job). When there is no image it renders a spacer
// of the same size so rows stay aligned. Shared by the knowledge-base tables
// and the vision review champion picker.
export default function ChampionThumbnail({
  imageUrl,
  name,
  size = 32,
  className,
}: Readonly<ChampionThumbnailProps>) {
  const src = getChampionImageUrl(imageUrl, size)
  const box = { width: size, height: size }

  if (!src)
    return (
      <span
        className={cn('shrink-0', className)}
        style={box}
      />
    )

  return (
    <img
      src={src}
      alt={name}
      className={cn('object-contain shrink-0', className)}
      style={box}
    />
  )
}
