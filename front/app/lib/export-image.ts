import { snapdom } from '@zumer/snapdom'

/** Width (px) we aim for in an exported PNG — a map or list narrower than this
 *  is captured at a bigger scale so the file stays readable when zoomed in. */
const TARGET_EXPORT_WIDTH = 2400
const MIN_EXPORT_SCALE = 2
const MAX_EXPORT_SCALE = 4
/** Safety net so a never-loading image can't block an export forever. */
const IMAGE_WAIT_TIMEOUT_MS = 5000

/**
 * Capture scale for an element: enough to reach TARGET_EXPORT_WIDTH, always at
 * least 2x (never the 1x screen resolution), capped so wide maps don't produce
 * gigantic files.
 */
export function getExportScale(element: HTMLElement): number {
  const width = element.getBoundingClientRect().width
  if (!width) return MIN_EXPORT_SCALE
  const scale = Math.ceil(TARGET_EXPORT_WIDTH / width)
  return Math.min(MAX_EXPORT_SCALE, Math.max(MIN_EXPORT_SCALE, scale))
}

/**
 * Resolve once every <img> inside the element has finished loading. Export mode
 * swaps thumbnails for full-resolution sources, so without this the capture can
 * happen while the new images are still in flight.
 */
export async function waitForImages(element: HTMLElement): Promise<void> {
  const pending = Array.from(element.querySelectorAll('img'))
    .filter((img) => !img.complete || img.naturalWidth === 0)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        })
    )
  if (pending.length === 0) return
  await Promise.race([
    Promise.all(pending),
    new Promise<void>((resolve) => setTimeout(resolve, IMAGE_WAIT_TIMEOUT_MS)),
  ])
}

/** Capture an element as a high-resolution PNG and trigger its download. */
export async function downloadElementAsPng(element: HTMLElement, filename: string): Promise<void> {
  await waitForImages(element)
  const png = await snapdom.toPng(element, {
    scale: getExportScale(element),
    embedFonts: true,
  })
  const link = document.createElement('a')
  link.download = filename
  link.href = png.src
  link.click()
}
