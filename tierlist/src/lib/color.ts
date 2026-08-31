/** Parse `#rgb` / `#rrggbb` into 0-255 channels; falls back to mid grey. */
function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  if (full.length !== 6) return [128, 128, 128]
  const int = Number.parseInt(full, 16)
  if (Number.isNaN(int)) return [128, 128, 128]
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/**
 * Black or white text for a tier label, whichever stays readable on the row's
 * colour. Tier colours are user-picked, so this cannot be hard-coded.
 */
export function readableTextColor(background: string): string {
  const [r, g, b] = channels(background)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#0a0e15' : '#f8fafc'
}
