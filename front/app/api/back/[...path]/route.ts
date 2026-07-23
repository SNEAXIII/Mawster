import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/app/api/auth/[...nextauth]/route'
import { getServerApiUrl } from '@/app/lib/serverApiUrl'

/**
 * Catch-all proxy: every request to /api/back/<path>
 * is forwarded server-side to FastAPI with the backend JWT
 * from the NextAuth session (never exposed to the client).
 *
 * Token refresh is handled transparently by the NextAuth jwt
 * callback — no manual refresh or cookie encoding needed here.
 */
async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const backendPath = path.join('/')
  const isPublicPath = backendPath === 'stats/public'

  const session = isPublicPath ? null : await auth()

  if (!isPublicPath && (!session?.accessToken || session.error === 'TokenExpiredError')) {
    const message = session?.error === 'TokenExpiredError' ? 'Session expired' : 'Unauthenticated'
    return NextResponse.json({ message }, { status: 401 })
  }

  const url = new URL(req.url)
  const backendUrl = `${getServerApiUrl()}/${backendPath}${url.search}`

  const headers: HeadersInit = {}
  if (!isPublicPath && session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  const contentType = req.headers.get('content-type')
  if (contentType) {
    headers['Content-Type'] = contentType
  }

  // Read the body as raw bytes, never as text: req.text() decodes as UTF-8, which
  // replaces every byte that isn't valid UTF-8 with U+FFFD. That silently destroys
  // any binary upload (a screenshot's PNG bytes) while leaving JSON untouched, so
  // the corruption only shows up far downstream.
  let body: ArrayBuffer | undefined
  if (!['GET', 'HEAD'].includes(req.method)) {
    try {
      const raw = await req.arrayBuffer()
      body = raw.byteLength > 0 ? raw : undefined
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(backendUrl, {
      method: req.method,
      headers,
      body,
    })

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 })
    }

    // Read the response as raw bytes, never as text: res.text() decodes as UTF-8,
    // which replaces every byte that isn't valid UTF-8 with U+FFFD. That would
    // destroy a binary response (e.g. a PNG crop) the same way it did on the
    // request side (see the comment above on req.arrayBuffer()).
    const data = await res.arrayBuffer()

    return new NextResponse(data.byteLength > 0 ? data : null, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (error) {
    console.error(`[proxy] ${req.method} ${backendUrl} →`, error)
    return NextResponse.json({ message: 'Internal proxy error' }, { status: 502 })
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
