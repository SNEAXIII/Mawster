import { PROXY, jsonHeaders } from '@/app/services/utils'

// ─── Types ───────────────────────────────────────────────
export interface VisionImport {
  id: string
  screens_total: number
}

export interface VisionJobDetail {
  id: string
  status: string
  error: string | null
}

export interface VisionImportStatus {
  id: string
  status: string
  screens_total: number
  screens_done: number
  jobs?: VisionJobDetail[]
}

export interface VisionPrediction {
  id: string
  job_id: string
  champion_name: string | null
  champion_class: string | null
  stars: number
  rank: number
  signature: number
  ascension: number
  confidence: number
  crop_index: number | null
  job_index: number
  // CLIP alternatives, best first, top-1 included.
  candidates: { name: string; score: number }[]
  // score[0] - score[1]. null when the model gave fewer than two candidates.
  // Signed: negative when `reranked` is true, because the winning candidate
  // keeps its own lower CLIP score. Read the two together.
  margin: number | null
  // The pixel second pass overrode CLIP's ranking on this card.
  reranked: boolean
}

export interface VisionPredictionsResponse {
  import_id: string
  predictions: VisionPrediction[]
}

export interface ConfirmedRow {
  champion_name: string
  rarity: string
  signature: number
  ascension: number
  is_preferred_attacker: boolean
  prediction_id: string | null
}

export interface CurrentVisionImport {
  id: string
  status: string
  screens_total: number
  screens_done: number
  created_at: string
  predictions_count: number
}

interface ApiError {
  detail?: string
  message?: string
  statusCode?: number
}

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return
  const data: ApiError = await response.json().catch(() => ({}))
  const msg = data.message ?? data.detail ?? fallback
  const err = new Error(`Erreur ${response.status}: ${msg}`)
  ;(err as Error & { status: number }).status = response.status
  throw err
}

// ─── Direct-to-storage upload (presigned) ────────────────
export interface VisionUploadTarget {
  job_id: string
  filename: string
  url: string
  content_type: string
}

export interface VisionInitResponse {
  import_id: string
  expires_in: number
  uploads: VisionUploadTarget[]
}

// Parallel PUTs to RustFS. Four because the win is overlapping latency, not
// saturating the uplink: past that the same bandwidth is split more ways, each
// file finishes later, and a phone connection starts timing out sockets.
const UPLOAD_CONCURRENCY = 4

const EXTENSION_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

// `File.type` is a best effort by the browser, not a guarantee: it comes back
// empty often enough (some Android pickers, drag-and-drop from an archive,
// Cypress `selectFile` without an explicit mimeType) that trusting it alone
// turns a valid screenshot into a 400 at init. The extension is the fallback,
// and neither is trusted — the backend sniffs the real bytes at commit.
const declaredType = (file: File): string =>
  file.type || EXTENSION_TYPES[file.name.split('.').pop()?.toLowerCase() ?? ''] || ''

const initVisionImport = async (
  gameAccountId: string,
  files: File[],
  shareDataset: boolean
): Promise<VisionInitResponse> => {
  const response = await fetch(`${PROXY}/vision/imports/init`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      game_account_id: gameAccountId,
      share_dataset: shareDataset,
      screens: files.map((file) => ({
        filename: file.name,
        content_type: declaredType(file),
        size: file.size,
      })),
    }),
  })
  await throwOnError(response, "Erreur lors de la préparation de l'import")
  return response.json()
}

// Straight to RustFS — not through the Next proxy, and not through the API.
// The URL carries its own signature, so no Authorization header is sent (and
// none would be accepted). Content-Type must match what the backend signed:
// it is part of the signature, and any other value fails the upload outright.
const putScreenshot = async (target: VisionUploadTarget, file: File): Promise<void> => {
  const response = await fetch(target.url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': target.content_type },
  })
  if (!response.ok) {
    throw new Error(`Upload de « ${target.filename} » échoué (${response.status})`)
  }
}

// Queues one screenshot as soon as its bytes are in the bucket, instead of
// letting it wait for the slowest file of the batch. The backend re-checks the
// stored object here — this call is what turns an anonymous PUT into a job.
const commitScreen = async (importId: string, jobId: string): Promise<void> => {
  const response = await fetch(`${PROXY}/vision/imports/${importId}/screens/${jobId}/commit`, {
    method: 'POST',
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la mise en file de la capture')
}

const commitVisionImport = async (importId: string): Promise<VisionImport> => {
  const response = await fetch(`${PROXY}/vision/imports/${importId}/commit`, {
    method: 'POST',
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de la validation de l'import")
  return response.json()
}

/**
 * Uploads roster screenshots straight to object storage, queueing each one the
 * moment it lands.
 *
 * Reserve (`init`), then per file: PUT to the bucket, `commitScreen` to queue
 * it. The batch used to be queued in one go at the end, which meant the GPU sat
 * idle for the whole upload; now extraction of the early screenshots overlaps
 * the upload of the late ones. `commit` at the end only seals what is left.
 *
 * One file failing no longer sinks the batch — the screenshots already queued
 * are running in the worker and cannot be recalled, so aborting would waste them
 * and tell the user nothing true. The failure is carried to the review screen as
 * a failed screenshot instead. The import is only cancelled when not a single
 * screenshot made it, where there is nothing to salvage and the "one import at a
 * time" lock would otherwise be held until the URLs expire.
 */
export const createVisionImport = async (
  gameAccountId: string,
  files: File[],
  shareDataset: boolean,
  onProgress?: (uploaded: number, total: number) => void
): Promise<VisionImport> => {
  const { import_id, uploads } = await initVisionImport(gameAccountId, files, shareDataset)

  let done = 0
  let next = 0
  let queued = 0
  let firstError: unknown = null
  const worker = async () => {
    while (next < uploads.length) {
      const index = next++
      try {
        await putScreenshot(uploads[index], files[index])
        await commitScreen(import_id, uploads[index].job_id)
        queued += 1
      } catch (error) {
        // Kept, not thrown: the sibling workers must keep going, and this is
        // what the user sees if it turns out nothing at all went through.
        firstError ??= error
      }
      // Counts attempts, not successes — the bar tracks how much of the batch
      // has been dealt with, and a file that failed is done being waited on.
      done += 1
      onProgress?.(done, uploads.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, uploads.length) }, worker))

  if (queued === 0) {
    // Best-effort: the import is already unusable, and surfacing a cancellation
    // failure here would replace the error the user actually needs to see.
    await cancelVisionImport(import_id).catch(() => {})
    throw firstError ?? new Error("Aucune capture n'a pu être envoyée")
  }

  return commitVisionImport(import_id)
}

export const getVisionImport = async (importId: string): Promise<VisionImportStatus> => {
  const response = await fetch(`${PROXY}/vision/imports/${importId}`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de la récupération de l'import")
  return response.json()
}

export const getVisionPredictions = async (
  importId: string
): Promise<VisionPredictionsResponse> => {
  const response = await fetch(`${PROXY}/vision/imports/${importId}/predictions`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la récupération des prédictions')
  return response.json()
}

// Every thumbnail of a screenshot lives in one sheet, so this is one request for
// the whole review screen instead of one per card. Plain URL builder — no
// request, no round-trip. See front/app/api/back/[...path]/route.ts, which
// forwards binary responses unchanged, and
// api/src/controllers/account/game/vision_controller.py.
export const getSpriteUrl = (importId: string, jobId: string): string =>
  `${PROXY}/vision/imports/${importId}/jobs/${jobId}/crops/sprite`

// Cell geometry, mirrored from mcoc-vision/worker/sprite.py (CELL = 192, COLS = 8).
// The sheet is always SPRITE_COLS cells wide, so scaling it to SPRITE_COLS box
// widths makes one cell exactly one box — these two numbers are all the slicing
// arithmetic needs. Changing either here without changing the worker puts the
// wrong champion's art beside a row.
export const SPRITE_COLS = 8
// The card's rank line ("Rang 4") is printed small inside the crop, and at 96
// it was unreadable on a phone — the one thing a reviewer needs to check the
// detected rarity against. 128 stays below the 192px source cell, so the
// thumbnail is still downscaled and never blurred.
export const SPRITE_DISPLAY = 128

export const confirmVisionImport = async (
  importId: string,
  rows: ConfirmedRow[],
  shareDataset: boolean
): Promise<{ samples_archived: number }> => {
  const response = await fetch(`${PROXY}/vision/imports/${importId}/confirm`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ rows, share_dataset: shareDataset }),
  })
  await throwOnError(response, "Erreur lors de la confirmation de l'import")
  return response.json()
}

export const getCurrentVisionImport = async (
  gameAccountId: string
): Promise<CurrentVisionImport | null> => {
  const response = await fetch(`${PROXY}/vision/imports/current?game_account_id=${gameAccountId}`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de la récupération de l'import en cours")
  if (response.status === 204) return null
  return response.json()
}

export const cancelVisionImport = async (importId: string): Promise<void> => {
  const response = await fetch(`${PROXY}/vision/imports/${importId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de l'annulation de l'import")
}

// Relaunches one screenshot the pipeline could not read. There is no
// import-wide retry: the banner calls this once per failed job (see
// VisionResultService.retry_job on the backend for why a failure is terminal
// until the user explicitly asks again).
export const retryVisionJob = async (jobId: string): Promise<void> => {
  const response = await fetch(`${PROXY}/vision/jobs/${jobId}/retry`, {
    method: 'POST',
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la relance de la capture')
}
