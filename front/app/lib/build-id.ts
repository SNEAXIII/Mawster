/**
 * Identifies the build the running code came from.
 *
 * `NEXT_PUBLIC_*` is inlined at build time, so this constant is baked into both
 * the server bundle and the JS shipped to the browser. That is what makes the
 * comparison in `useVersionCheck` meaningful: a tab opened before a deploy
 * carries the old value while `/api/version` answers with the new one.
 *
 * Empty outside CI (local `npm run build`, E2E), which disables the check
 * rather than comparing two meaningless values.
 */
export const BUILD_ID: string = process.env.NEXT_PUBLIC_BUILD_ID ?? ''
