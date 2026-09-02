'use client'

import React from 'react'
import { getChampionImageUrl } from '@/app/services/champions'
import { getStarFrameUrl } from '@/app/services/roster'
import SynergyBadge from '@/components/synergy-badge'
import PrefightBadge from '@/components/prefight-badge'
import PreferredBadge from '@/components/preferred-badge'
import SagaBadge from '@/components/saga-badge'
import AscensionBadge from '@/components/ascension-badge'
import { useExportMode } from '@/app/contexts/export-mode-context'

type mode = 'normal' | 'synergy' | 'prefight'
type SagaMode = 'attacker' | 'defender' | 'all'

/**
 * Shape of the outer box:
 * - 'square' — size x size, the frame letterboxed inside it
 * - 'frame'  — size x size/1.218, no dead space above and below the frame
 */
export type BoxShape = 'square' | 'frame'

/** Both star frames share the same aspect ratio (212x174 and 106x87). */
const FRAME_ASPECT = 212 / 174

/**
 * Where the champion image sits inside the frame, as fractions of the frame's
 * own width/height.
 *
 * `left`/`width` keep the frame's side pillars visible; `top` sits above the
 * frame's top bar (row 13/174 on the 6* asset, 3/87 on the 7*) so the artwork
 * runs over it like in game, and `height` stops where the bottom band starts
 * (row 153/174 and 75/87). `focusY` is the object-position used when the square
 * source is cropped to the wider-than-tall window — 0 keeps heads in frame.
 */
export interface FrameWindow {
  left: number
  top: number
  width: number
  height: number
  focusY: number
}

export const FRAME_WINDOWS: Record<string, FrameWindow> = {
  '6': { left: 0.1274, top: 0.0747, width: 0.7264, height: 0.8046, focusY: 0 },
  '7': { left: 0.1132, top: 0.0345, width: 0.7547, height: 0.8276, focusY: 0 },
}

/** Pre-resized champion thumbnails that exist on the static server. */
const THUMBNAIL_SIZES = [32, 40, 60]

/**
 * Smallest pre-resized thumbnail that covers `cssPx`, or `undefined` for the
 * full-resolution source when the portrait is bigger than every variant.
 * Deliberately ignores devicePixelRatio: it is not known during SSR (hydration
 * mismatch) and pulling the 256px source for a whole roster costs far more than
 * the extra sharpness is worth.
 */
export function pickThumbnailSize(cssPx: number): number | undefined {
  return THUMBNAIL_SIZES.find((s) => s >= cssPx)
}

/**
 * Rect of the frame's transparent window, in px inside the square box.
 * The frame is `object-contain` in a square box, so it renders full-width and
 * letterboxed vertically — the window has to be offset by that letterbox.
 */
export function getFrameWindowRect(
  size: number,
  rarity: string,
  override?: FrameWindow,
  box: BoxShape = 'square'
) {
  const w = override ?? FRAME_WINDOWS[rarity.charAt(0)] ?? FRAME_WINDOWS['6']
  const frameHeight = size / FRAME_ASPECT
  const letterbox = box === 'frame' ? 0 : (size - frameHeight) / 2
  return {
    left: w.left * size,
    top: letterbox + w.top * frameHeight,
    width: w.width * size,
    height: w.height * frameHeight,
  }
}

interface ChampionPortraitProps {
  imageUrl: string | null
  name: string
  rarity: string
  /** Outer size in px (default 56) */
  size?: number
  /** Optional badge rendered absolutely over the portrait (bottom-right) */
  mode?: mode
  /** Star badge at top-left indicating a player's preferred attacker */
  isPreferred?: boolean
  /** Whether champion is a saga attacker */
  is_saga_attacker?: boolean
  /** Whether champion is a saga defender */
  is_saga_defender?: boolean
  /**
   * Controls which saga flag triggers the "S" badge:
   * - 'attacker' — show if is_saga_attacker
   * - 'defender' — show if is_saga_defender
   * - 'all'      — show if either (default)
   */
  sagaMode?: SagaMode
  /** Purple "A1"/"A2" badge at top-right for ascension level (0 = no badge) */
  ascension?: number
  /** Override the image placement inside the frame — used by the /dev/portrait lab */
  frameWindow?: FrameWindow
  /** Outer box shape — 'frame' drops the vertical dead space (default 'square') */
  box?: BoxShape
  dataCy?: string
}

/**
 * Champion portrait with the star frame behind the champion image.
 * The frame sits underneath; the champion image is on top, snapped exactly onto
 * the frame's transparent window — computed from the frame's real geometry, so
 * the fit holds at every size instead of only around 72px like the old fixed
 * 6px inset did.
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
  frameWindow,
  box = 'square',
  dataCy,
}: Readonly<ChampionPortraitProps>) {
  const sagaByMode: Record<typeof sagaMode, boolean> = {
    attacker: is_saga_attacker,
    defender: is_saga_defender,
    all: is_saga_attacker || is_saga_defender,
  }
  const showSaga = sagaByMode[sagaMode]
  const exporting = useExportMode()
  const frameUrl = getStarFrameUrl(rarity)
  const windowRect = getFrameWindowRect(size, rarity, frameWindow, box)
  const focusY = (frameWindow ?? FRAME_WINDOWS[rarity.charAt(0)] ?? FRAME_WINDOWS['6']).focusY
  // Pre-resized thumbnail on screen; full-resolution source while exporting, so
  // the upscaled PNG capture stays sharp.
  const imgSize = exporting ? undefined : pickThumbnailSize(windowRect.width)
  // Lazy off-screen images: a full roster mounts hundreds of portraits at once.
  // Never lazy while exporting — html2canvas snapshots the DOM synchronously and
  // would capture blanks for anything the browser hasn't decided to load yet.
  const eagerLoad = exporting
  const windowStyle: React.CSSProperties = { position: 'absolute', ...windowRect }

  return (
    <div
      className='relative shrink-0'
      style={{ width: size, height: box === 'frame' ? size / FRAME_ASPECT : size }}
      data-cy={dataCy ?? `champion-portrait-${name}-${mode}`}
    >
      {/* Star frame – behind */}
      <img
        src={frameUrl}
        alt=''
        loading={eagerLoad ? 'eager' : 'lazy'}
        decoding='async'
        className='absolute inset-0 w-full h-full object-contain pointer-events-none'
      />
      {/* Champion image – on top, filling the frame's window. `focusY` keeps the
          head in view: the source art is square and the window is wider than
          tall, so a centred crop would eat into it. */}
      {imageUrl ? (
        <img
          src={getChampionImageUrl(imageUrl, imgSize) ?? ''}
          alt={name}
          loading={eagerLoad ? 'eager' : 'lazy'}
          decoding='async'
          className='object-cover z-10'
          style={{ ...windowStyle, objectPosition: `50% ${focusY * 100}%` }}
        />
      ) : (
        <div
          className='bg-gray-700 flex items-center justify-center text-gray-400 text-xs z-10'
          style={windowStyle}
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
  )
}
