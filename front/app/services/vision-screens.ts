import type { VisionPreview } from '@/app/services/vision'

// Best-effort: a cache failure only costs the presigned-URL fallback, never an upload.
const CACHE_NAME = 'vision-screens'

const screenKey = (jobId: string): string => `/vision-screens/${jobId}`

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
  try {
    const cache = await caches.open(CACHE_NAME)
    const hit = await cache.match(screenKey(jobId))
    return hit ? URL.createObjectURL(await hit.blob()) : null
  } catch {
    return null
  }
}

export const clearScreens = async (): Promise<void> => {
  try {
    await caches.delete(CACHE_NAME)
  } catch {
    // Nothing to clear when the Cache API is missing or refuses.
  }
}

// The cached blob wins: it is the same bytes without a round-trip to the bucket.
export const resolveScreenUrls = async (
  screens: Record<string, string>
): Promise<Record<string, string>> => {
  const entries = await Promise.all(
    Object.entries(screens).map(async ([jobId, presigned]): Promise<[string, string]> => [
      jobId,
      (await getCachedScreenUrl(jobId)) ?? presigned,
    ])
  )
  return Object.fromEntries(entries)
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
