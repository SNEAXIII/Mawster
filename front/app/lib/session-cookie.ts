// Same cookie choice as Auth.js: secure cookie name when the app URL is https.
export const SECURE_COOKIE = (
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  'https:'
).startsWith('https:')

export const SESSION_COOKIE = `${SECURE_COOKIE ? '__Secure-' : ''}authjs.session-token`
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60
