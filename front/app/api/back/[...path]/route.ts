import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { SERVER_API_URL } from '@/next.config';

/**
 * Catch-all proxy : toute requête vers /api/back/<path>
 * est relayée côté serveur vers FastAPI avec le JWT backend
 * récupéré dans le cookie NextAuth (jamais exposé au client).
 */
async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token?.accessToken) {
    return NextResponse.json({ message: 'Non authentifié' }, { status: 401 });
  }

  // Await params (Next.js 15+)
  const { path } = await params;

  // Reconstruit l'URL backend
  const backendPath = path.join('/');
  const url = new URL(req.url);
  const search = url.search; // conserve les query params
  const backendUrl = `${SERVER_API_URL}/${backendPath}${search}`;

  // Prépare les headers
  const headers: HeadersInit = {
    Authorization: `Bearer ${token.accessToken}`,
  };

  // Transmet le Content-Type s'il y a un body
  const contentType = req.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  // Lit le body si présent (POST, PUT, PATCH, DELETE avec body)
  let body: string | undefined;
  if (!['GET', 'HEAD'].includes(req.method)) {
    try {
      body = await req.text();
    } catch {
      // pas de body
    }
  }

  try {
    const res = await fetch(backendUrl, {
      method: req.method,
      headers,
      body: body || undefined,
    });

    // 204 No Content — renvoyer directement sans body
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
    return NextResponse.json({ message: 'Erreur de proxy interne' }, { status: 502 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
