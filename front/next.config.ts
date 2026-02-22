import type { NextConfig } from 'next';
const API_SERVER_HOST = process.env.NODE_ENV === 'production' ? 'api' : 'localhost';
const API_PORT = process.env.API_PORT ?? '8000';
const NEXT_PUBLIC_API_CLIENT_HOST = process.env.NEXT_PUBLIC_API_CLIENT_HOST ?? 'localhost';
const API_CLIENT_END_PART = process.env.NODE_ENV === 'production' ? '/api/back' : `:${API_PORT}`;
const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/static/:path*',
        destination: `${SERVER_API_URL}/static/:path*`,
      },
    ];
  },
};
export const CLIENT_API_URL: string = `http://${NEXT_PUBLIC_API_CLIENT_HOST}${API_CLIENT_END_PART}`;
export const SERVER_API_URL: string = `http://${API_SERVER_HOST}:${API_PORT}`;
export default nextConfig;
