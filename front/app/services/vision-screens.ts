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
