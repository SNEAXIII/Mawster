import type { CSSProperties } from 'react'
import {
  FRAME_ASPECT,
  FRAME_WINDOWS,
  ascensionBadgeUrl,
  championImageUrl,
  frameUrl,
  frameWindowRect,
  pickThumbnailSize,
} from '@/lib/assets'
import { useAnonymousImages } from '@/lib/asset-mode'
import type { Champion, FrameOption } from '@/lib/types'

interface ChampionPortraitProps {
  champion: Champion
  /** Outer width in px. Height follows the frame's aspect ratio. */
  size: number
  frame: FrameOption
  /** Gold ascension chevron, drawn only when the champion can actually ascend. */
  showAscension?: boolean
  /** Skip lazy loading and pre-resized thumbnails, so a PNG capture stays sharp. */
  exporting?: boolean
}

/**
 * Champion artwork snapped into the transparent window of the star frame.
 * The frame sits underneath and the artwork on top, positioned from the frame's
 * real geometry, so the fit holds at every size instead of only around 72px.
 */
export default function ChampionPortrait({
  champion,
  size,
  frame,
  showAscension = true,
  exporting = false,
}: Readonly<ChampionPortraitProps>) {
  const anonymous = useAnonymousImages()
  // Re-keying on the mode forces a refetch when the CORS probe flips it.
  const crossOrigin = anonymous ? 'anonymous' : undefined
  const height = frame === 'none' ? size : size / FRAME_ASPECT
  const rect = frameWindowRect(size, frame, false)
  const focusY = frame === 'none' ? 0.5 : FRAME_WINDOWS[frame].focusY
  const imgSize = exporting ? undefined : pickThumbnailSize(rect.width)
  const loading = exporting ? 'eager' : 'lazy'
  const windowStyle: CSSProperties = { position: 'absolute', ...rect }

  return (
    <div
      className='relative shrink-0'
      style={{ width: size, height }}
    >
      {frame !== 'none' && (
        <img
          key={`frame-${crossOrigin}`}
          src={frameUrl(frame)}
          alt=''
          crossOrigin={crossOrigin}
          loading={loading}
          decoding='async'
          className='pointer-events-none absolute inset-0 h-full w-full object-contain'
        />
      )}
      <img
        key={`art-${crossOrigin}`}
        src={championImageUrl(champion.imageUrl, imgSize)}
        alt={champion.name}
        crossOrigin={crossOrigin}
        loading={loading}
        decoding='async'
        className='z-10 object-cover'
        style={{ ...windowStyle, objectPosition: `50% ${focusY * 100}%` }}
      />
      {showAscension && champion.isAscendable && (
        <img
          key={`asc-${crossOrigin}`}
          src={ascensionBadgeUrl()}
          alt=''
          crossOrigin={crossOrigin}
          loading={loading}
          decoding='async'
          className='pointer-events-none absolute z-20'
          style={{
            width: size / 2.6,
            height: size / 2.6,
            top: -size / 22,
            right: -size / 14,
          }}
        />
      )}
    </div>
  )
}
