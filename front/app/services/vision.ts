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

// ─── Vision Import API ───────────────────────────────────
export const createVisionImport = async (
  gameAccountId: string,
  files: File[],
  shareDataset: boolean
): Promise<VisionImport> => {
  const formData = new FormData()
  formData.append('game_account_id', gameAccountId)
  files.forEach((file) => formData.append('files', file))
  formData.append('share_dataset', String(shareDataset))

  const response = await fetch(`${PROXY}/vision/imports`, {
    method: 'POST',
    body: formData,
  })
  await throwOnError(response, "Erreur lors de la création de l'import")
  return response.json()
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
