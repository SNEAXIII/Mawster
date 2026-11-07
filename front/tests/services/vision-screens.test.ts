import { afterEach, describe, expect, it, vi } from 'vitest'
import { cacheScreen, clearScreens, getCachedScreenUrl } from '@/app/services/vision-screens'

const stubCaches = () => {
  const entries = new Map<string, Response>()
  const cache = {
    put: vi.fn(async (key: string, response: Response) => {
      entries.set(key, response)
    }),
    match: vi.fn(async (key: string) => entries.get(key)?.clone()),
  }
  const storage = {
    open: vi.fn(async () => cache),
    delete: vi.fn(async () => true),
  }
  vi.stubGlobal('caches', storage)
  return { cache, storage }
}

const screenshot = () => new File(['png-bytes'], 'roster.png', { type: 'image/png' })

afterEach(() => {
  vi.restoreAllMocks()
})

describe('vision screens cache', () => {
  it('returns an object URL of the cached screenshot on a hit', async () => {
    const { cache } = stubCaches()
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:screen')

    await cacheScreen('job-1', screenshot())
    const url = await getCachedScreenUrl('job-1')

    expect(cache.put).toHaveBeenCalledWith('/vision-screens/job-1', expect.any(Response))
    expect(url).toBe('blob:screen')
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('image/png')
    expect(blob.size).toBe('png-bytes'.length)
  })

  it('returns null when the job was never cached', async () => {
    stubCaches()
    expect(await getCachedScreenUrl('job-missing')).toBeNull()
  })

  it('resolves when the cache refuses the write', async () => {
    const { cache } = stubCaches()
    cache.put.mockRejectedValueOnce(new Error('quota exceeded'))

    await expect(cacheScreen('job-1', screenshot())).resolves.toBeUndefined()
  })

  it('treats a missing caches global as a miss and never throws', async () => {
    vi.stubGlobal('caches', undefined)

    await expect(cacheScreen('job-1', screenshot())).resolves.toBeUndefined()
    expect(await getCachedScreenUrl('job-1')).toBeNull()
    await expect(clearScreens()).resolves.toBeUndefined()
  })

  it('clears the named cache', async () => {
    const { storage } = stubCaches()

    await clearScreens()

    expect(storage.delete).toHaveBeenCalledWith('vision-screens')
  })
})
