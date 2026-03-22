/**
 * Returns the backend API base URL for server-side route handlers.
 *
 * Must NOT be a module-level constant: next.config.ts is processed by
 * Turbopack in a special config context where process.env vars may not
 * be available. Calling a function at request time guarantees the real
 * runtime value is used.
 *
 * Bracket notation (process.env['API_PORT']) prevents bundler static inlining.
 */
export function getServerApiUrl(): string {
  const port = process.env['API_PORT'] ?? '8000';
  const isDockerProd = process.env.NODE_ENV === 'production' && process.env['DEV_MODE'] !== 'true';
  const host = isDockerProd ? 'api' : 'localhost';
  return `http://${host}:${port}`;
}
