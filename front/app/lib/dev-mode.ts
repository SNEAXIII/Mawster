/**
 * Dev mode detection — centralized.
 *
 * IS_DEV          → client components ('use client') and shared modules.
 *                   Uses NEXT_PUBLIC_DEV_MODE (baked at build time).
 *
 * isServerDev()   → Route Handlers and Server Components only.
 *                   Reads DEV_MODE at runtime (bracket notation prevents bundler inlining).
 */

/** Client-side / shared modules. */
export const IS_DEV =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEV_MODE === 'true';

/** Server-side Route Handlers and Server Components. */
export function isServerDev(): boolean {
  return process.env.NODE_ENV === 'development' || process.env['DEV_MODE'] === 'true';
}
