import { normalizeBoard } from './board'
import type { BoardState } from './types'

/** Width (px) an exported PNG aims for, so the board stays readable zoomed in. */
const TARGET_EXPORT_WIDTH = 2400
const MIN_EXPORT_SCALE = 2
const MAX_EXPORT_SCALE = 4
/** Safety net so a never-loading portrait can't block an export forever. */
const IMAGE_WAIT_TIMEOUT_MS = 8000

function download(href: string, filename: string): void {
  const link = document.createElement('a')
  link.download = filename
  link.href = href
  link.click()
}

function slugifyTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return slug || 'mawster-tierlist'
}

export function exportJson(board: BoardState): void {
  const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  download(url, `${slugifyTitle(board.title)}.json`)
  URL.revokeObjectURL(url)
}

/** Parse an uploaded export. Returns `null` when the file is not a board. */
export async function importJson(file: File): Promise<BoardState | null> {
  try {
    return normalizeBoard(JSON.parse(await file.text()))
  } catch {
    return null
  }
}

function exportScale(element: HTMLElement): number {
  const width = element.getBoundingClientRect().width
  if (!width) return MIN_EXPORT_SCALE
  const scale = Math.ceil(TARGET_EXPORT_WIDTH / width)
  return Math.min(MAX_EXPORT_SCALE, Math.max(MIN_EXPORT_SCALE, scale))
}

/**
 * Resolve once every <img> inside the element has finished loading — portraits
 * are lazy-loaded off-screen, and snapdom snapshots the DOM synchronously, so
 * without this the capture would contain blanks.
 */
async function waitForImages(element: HTMLElement): Promise<void> {
  const pending = Array.from(element.querySelectorAll('img'))
    .filter((img) => !img.complete || img.naturalWidth === 0)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        })
    )
  if (pending.length === 0) return
  await Promise.race([
    Promise.all(pending).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_TIMEOUT_MS)),
  ])
}

/** Capture the tier board as a high-resolution PNG and trigger its download. */
export async function exportPng(element: HTMLElement, board: BoardState): Promise<void> {
  await waitForImages(element)
  // Loaded on demand: snapdom is a third of the bundle and only the PNG
  // export needs it.
  const { snapdom } = await import('@zumer/snapdom')
  const png = await snapdom.toPng(element, { scale: exportScale(element), embedFonts: true })
  download(png.src, `${slugifyTitle(board.title)}.png`)
}
