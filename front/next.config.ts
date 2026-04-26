import type { NextConfig } from 'next';
const API_SERVER_HOST =
  process.env.API_SERVER_HOST ?? (process.env.NODE_ENV === 'production' ? 'api' : 'localhost');
const API_PORT = process.env.API_PORT ?? '8000';
const STATIC_SERVER_HOST =
  process.env.STATIC_SERVER_HOST ?? (process.env.NODE_ENV === 'production' ? 'static' : 'localhost');
const STATIC_PORT = process.env.STATIC_PORT ?? '8002';
const NEXT_PUBLIC_API_CLIENT_HOST = process.env.NEXT_PUBLIC_API_CLIENT_HOST ?? 'localhost';
const API_CLIENT_END_PART = process.env.NODE_ENV === 'production' ? '/api/back' : `:${API_PORT}`;
const port = process.env.PORT ?? '3000';
const nextConfig: NextConfig = {
  output: process.env.NEXT_E2E_BUILD ? undefined : 'standalone',
  distDir: process.env.NEXT_DIST_DIR ?? (port !== '3000' ? `.next-${port}` : '.next'),
  async rewrites() {
    return [
      {
        source: '/static/:path*',
        destination: `http://${STATIC_SERVER_HOST}:${STATIC_PORT}/static/:path*`,
      },
      {
        source: '/__open-stack-frame-in-editor',
        destination: '/api/dev/open-editor',
      },
      {
        source: '/__open-stack-frame-in-editor/relative',
        destination: '/api/dev/open-editor',
      },
    ];
  },
};
export const CLIENT_API_URL: string = `http://${NEXT_PUBLIC_API_CLIENT_HOST}${API_CLIENT_END_PART}`;
const SERVER_API_URL: string = `http://${API_SERVER_HOST}:${API_PORT}`;
export default nextConfig;
