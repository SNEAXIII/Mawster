// ─── Types ───────────────────────────────────────────────
export interface VisionImport {
  id: string
  screens_total: number
}

export interface VisionImportStatus {
  id: string
  status: string
  screens_total: number
  screens_done: number
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

interface CropUrlResponse {
  url: string
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

export const getCropUrl = async (
  importId: string,
  jobId: string,
  index: number
): Promise<string> => {
  const response = await fetch(`${PROXY}/vision/imports/${importId}/jobs/${jobId}/crops/${index}`, {
    headers: jsonHeaders,
  })
  await throwOnError(response, 'Erreur lors de la récupération du crop')
  const data: CropUrlResponse = await response.json()
  return data.url
}

export const confirmVisionImport = async (
  importId: string,
  rows: ConfirmedRow[]
): Promise<{ samples_archived: number }> => {
  const response = await fetch(`${PROXY}/vision/imports/${importId}/confirm`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ rows }),
  })
  await throwOnError(response, "Erreur lors de la confirmation de l'import")
  return response.json()
}
