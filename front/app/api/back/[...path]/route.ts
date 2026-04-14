import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { getServerApiUrl } from '@/app/lib/serverApiUrl';

/**
 * Catch-all proxy: every request to /api/back/<path>
 * is forwarded server-side to FastAPI with the backend JWT
 * from the NextAuth session (never exposed to the client).
 *
 * Token refresh is handled transparently by the NextAuth jwt
 * callback — no manual refresh or cookie encoding needed here.
 */
async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();

  if (!session?.accessToken || session.error === 'TokenExpiredError') {
    const status = session?.error === 'TokenExpiredError' ? 401 : 401;
    const message = session?.error === 'TokenExpiredError' ? 'Session expirée' : 'Non authentifié';
    return NextResponse.json({ message }, { status });
  }

  const { path } = await params;
  const backendPath = path.join('/');
  const url = new URL(req.url);
  const backendUrl = `${getServerApiUrl()}/${backendPath}${url.search}`;

  const headers: HeadersInit = {
    Authorization: `Bearer ${session.accessToken}`,
  };

  const contentType = req.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  let body: string | undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    try {
      body = await req.text();
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(backendUrl, {
      method: req.method,
      headers,
      body: body || undefined,
    });

    if (res.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const data = await res.text();

    return new NextResponse(data || null, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (error) {
    console.error(`[proxy] ${req.method} ${backendUrl} →`, error);
    return NextResponse.json({ message: 'Internal proxy error' }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
