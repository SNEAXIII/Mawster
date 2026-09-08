/**
 * Black or white, whichever stays readable on a row colour the user picked.
 *
 * The rows take any CSS colour, so the label cannot be given a fixed colour:
 * on a pale yellow, white text disappears. Relative luminance decides.
 */
export function readableTextColor(background: string): '#000000' | '#ffffff' {
  const hex = background.replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  if (full.length !== 6) return '#000000'
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255)
  const channel = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  return luminance > 0.45 ? '#000000' : '#ffffff'
}
