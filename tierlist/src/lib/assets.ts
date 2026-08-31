import type { FrameOption } from './types'

/** Portraits and star frames are served by the Mawster static host, not by Pages. */
export const STATIC_ORIGIN = 'https://www.mawster.app'

/** Pre-resized champion thumbnails that exist on the static server. */
const THUMBNAIL_SIZES = [32, 40, 60]

/**
 * Smallest pre-resized thumbnail that covers `cssPx`, or `undefined` for the
 * full-resolution source when the portrait is bigger than every variant.
 * Deliberately ignores devicePixelRatio — pulling the 256px source for 330
 * portraits costs far more than the extra sharpness is worth.
 */
export function pickThumbnailSize(cssPx: number): number | undefined {
  return THUMBNAIL_SIZES.find((s) => s >= cssPx)
}

/** Absolute URL of a champion portrait, optionally the `_NxN` pre-resized variant. */
export function championImageUrl(imageUrl: string, size?: number): string {
  if (!size) return `${STATIC_ORIGIN}${imageUrl}`
  const dot = imageUrl.lastIndexOf('.')
  const sized =
    dot === -1
      ? `${imageUrl}_${size}x${size}.png`
      : `${imageUrl.slice(0, dot)}_${size}x${size}${imageUrl.slice(dot)}`
  return `${STATIC_ORIGIN}${sized}`
}

export function frameUrl(frame: Exclude<FrameOption, 'none'>): string {
  return `${STATIC_ORIGIN}/static/frame/${frame}_stars.png`
}

export function ascensionBadgeUrl(): string {
  return `${STATIC_ORIGIN}/static/frame/ascended_1.png`
}

/** Both star frames share this aspect ratio (212x174 and 106x87 source assets). */
export const FRAME_ASPECT = 212 / 174

/**
 * Where the champion artwork sits inside a frame, as fractions of the frame's
 * own width/height — copied from the Mawster app so the fit is identical.
 *
 * `left`/`width` keep the frame's side pillars visible; `top` sits above the
 * frame's top bar so the artwork runs over it like in game, and `height` stops
 * where the bottom band starts. `focusY` is the object-position used when the
 * square source is cropped to the wider-than-tall window — 0 keeps heads in frame.
 */
export interface FrameWindow {
  left: number
  top: number
  width: number
  height: number
  focusY: number
}

export const FRAME_WINDOWS: Record<Exclude<FrameOption, 'none'>, FrameWindow> = {
  '6': { left: 0.1274, top: 0.0747, width: 0.7264, height: 0.8046, focusY: 0 },
  '7': { left: 0.1132, top: 0.0345, width: 0.7547, height: 0.8276, focusY: 0 },
}

/**
 * Rect of the frame's transparent window, in px inside the portrait box. The
 * frame renders full-width and letterboxed vertically inside a square box, so
 * the window has to be offset by that letterbox; a `frame`-shaped box has none.
 */
export function frameWindowRect(size: number, frame: FrameOption, square: boolean) {
  if (frame === 'none') return { left: 0, top: 0, width: size, height: size }
  const w = FRAME_WINDOWS[frame]
  const frameHeight = size / FRAME_ASPECT
  const letterbox = square ? (size - frameHeight) / 2 : 0
  return {
    left: w.left * size,
    top: letterbox + w.top * frameHeight,
    width: w.width * size,
    height: w.height * frameHeight,
  }
}
