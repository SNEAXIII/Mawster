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

// ─── Helpers ─────────────────────────────────────────────
const PROXY = '/api/back'

const jsonHeaders: HeadersInit = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
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

const commitVisionImport = async (importId: string): Promise<VisionImport> => {
  const response = await fetch(`${PROXY}/vision/imports/${importId}/commit`, {
    method: 'POST',
    headers: jsonHeaders,
  })
  await throwOnError(response, "Erreur lors de la validation de l'import")
  return response.json()
}

/**
 * Uploads roster screenshots straight to object storage, then queues them.
 *
 * Three steps: reserve (`init`), upload in parallel, queue (`commit`). Replaces
 * the single multipart POST, whose bytes crossed the Next proxy and the API
 * before reaching the bucket they were always headed for — and did it serially,
 * because the proxy buffers a whole request body before forwarding any of it.
 *
 * On any upload failure the reserved import is cancelled. Without that, a
 * half-uploaded batch would hold the "one import at a time" lock until its URLs
 * expire, and the user's retry would be refused for fifteen minutes.
 */
export const createVisionImport = async (
  gameAccountId: string,
  files: File[],
  shareDataset: boolean,
  onProgress?: (uploaded: number, total: number) => void
): Promise<VisionImport> => {
  const { import_id, uploads } = await initVisionImport(gameAccountId, files, shareDataset)

  try {
    let done = 0
    let next = 0
    const worker = async () => {
      while (next < uploads.length) {
        const index = next++
        await putScreenshot(uploads[index], files[index])
        done += 1
        onProgress?.(done, uploads.length)
      }
    }
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, uploads.length) }, worker))
  } catch (error) {
    // Best-effort: the import is already unusable, and surfacing a cancellation
    // failure here would replace the error the user actually needs to see.
    await cancelVisionImport(import_id).catch(() => {})
    throw error
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
export const SPRITE_DISPLAY = 96

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
