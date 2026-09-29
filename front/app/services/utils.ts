export const PROXY = '/api/back'

export const jsonHeaders: HeadersInit = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

async function throwOnError(response: Response, fallback: string): Promise<void> {
  if (response.ok) return
  const data: { message?: string; detail?: string } = await response.json().catch(() => ({}))
  const err = new Error(`Erreur ${response.status}: ${data.message ?? data.detail ?? fallback}`)
  ;(err as Error & { status: number }).status = response.status
  throw err
}

/** JSON request through the backend proxy; `path` is what follows `/api/back`. */
export async function api<T>(path: string, fallback: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PROXY}${path}`, { headers: jsonHeaders, ...init })
  await throwOnError(response, fallback)
  const text = await response.text()
  return text ? JSON.parse(text) : (undefined as T)
}

export function jsonBody(method: string, payload?: unknown): RequestInit {
  return { method, body: payload === undefined ? undefined : JSON.stringify(payload) }
}
