import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isServerDev } from '@/app/lib/dev-mode';

const PUBLIC_PATHS = ['/', '/api/auth', '/login', '/register'];
const ADMIN_PATHS = ['/admin'];

function isPathMatching(path: string, paths: string[]): boolean {
  return paths.some((basePath) => path === basePath || path.startsWith(`${basePath}/`));
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  const { pathname } = request.nextUrl;
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie: !isServerDev(),
  });
  const isTokenExpired = token?.expired || !token?.backendAuthenticated;

  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  const redirect = (url: string | URL) => NextResponse.redirect(new URL(url, request.url));

  // 1. Redirect authenticated users away from login/register pages
  if (token && !isTokenExpired && (pathname === '/login' || pathname === '/register')) {
    return redirect('/');
  }
  // 2. Allow public paths without authentication
  if (isPathMatching(pathname, PUBLIC_PATHS)) {
    return next();
  }
  // 3. Redirect unauthenticated users
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return redirect(loginUrl);
  }
  // 4. Handle expired tokens
  if (isTokenExpired) {
    return redirect('/login');
  }
  // 5. Restrict admin paths to admin or super_admin users
  if (
    isPathMatching(pathname, ADMIN_PATHS) &&
    token?.role !== 'admin' &&
    token?.role !== 'super_admin'
  ) {
    return redirect('/');
  }
  // 6. For all other cases, continue
  return next();
}

export const config = {
  // https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$|.*\\.ico$).*)'],
};
