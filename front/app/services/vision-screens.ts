import type { VisionPreview } from '@/app/services/vision'

// Best-effort: a cache failure only costs the presigned-URL fallback, never an upload.
const CACHE_NAME = 'vision-screens'
const PRELOAD_TIMEOUT_MS = 5000

const screenKey = (jobId: string): string => `/vision-screens/${jobId}`

// One URL per job: a new one on each reopened review would make the browser reload the image.
const objectUrls = new Map<string, string>()

// `new Response(file)` takes its Content-Type from the File, so the type is kept as declared.
export const cacheScreen = async (jobId: string, file: File): Promise<void> => {
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(screenKey(jobId), new Response(file))
  } catch {
    // Dropped on purpose: the review row falls back to the presigned URL.
  }
}

export const getCachedScreenUrl = async (jobId: string): Promise<string | null> => {
  const known = objectUrls.get(jobId)
  if (known) return known
  try {
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(screenKey(jobId))
    if (!hit) return null
    const url = URL.createObjectURL(await hit.blob())
    objectUrls.set(jobId, url)
    return url
  } catch {
    return null
  }
}

export const clearScreens = async (): Promise<void> => {
  objectUrls.forEach((url) => URL.revokeObjectURL(url))
  objectUrls.clear()
  try {
    await caches.delete(CACHE_NAME)
  } catch {
    // Nothing to clear when the Cache API is missing or refuses.
  }
}

// A browser that did not upload the screen keeps it too, so it downloads each one once.
const downloadScreen = async (jobId: string, presigned: string): Promise<string> => {
  try {
    const cache = await caches.open(CACHE_NAME)
    const response = await fetch(presigned, { signal: AbortSignal.timeout(PRELOAD_TIMEOUT_MS) })
    if (!response.ok) return presigned
    await cache.put(screenKey(jobId), response)
    return (await getCachedScreenUrl(jobId)) ?? presigned
  } catch {
    return presigned
  }
}

// The cached blob wins: it is the same bytes without a round-trip to the bucket.
export const resolveScreenUrls = async (
  screens: Record<string, string>
): Promise<Record<string, string>> => {
  const entries = await Promise.all(
    Object.entries(screens).map(async ([jobId, presigned]): Promise<[string, string]> => [
      jobId,
      (await getCachedScreenUrl(jobId)) ?? (await downloadScreen(jobId, presigned)),
    ])
  )
  return Object.fromEntries(entries)
}

// Bounded: a slow bucket may delay the review, never block it. A dead URL is the row's onError.
export const preloadScreens = async (urls: string[]): Promise<void> => {
  const decoded = urls.map((url) => {
    const image = new Image()
    image.src = url
    return image.decode().catch(() => {})
  })
  await Promise.race([
    Promise.all(decoded),
    new Promise((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
  ])
}

// At natural size one CSS px is one screenshot px, so no image dimension is needed.
export const previewImageStyle = (preview: VisionPreview, boxWidth: number) => {
  const w = preview.right - preview.left
  return {
    transformOrigin: '0 0',
    transform: `scale(${boxWidth / w}) translate(${-preview.left}px, ${-preview.top}px)`,
  }
}

export const previewAspectRatio = (preview: VisionPreview): number =>
  (preview.right - preview.left) / (preview.bottom - preview.top)
