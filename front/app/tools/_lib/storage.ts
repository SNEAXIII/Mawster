/**
 * Browser storage for the signed-out board and the display preferences.
 *
 * A signed-out visitor keeps exactly one board, here. Signing in does not
 * migrate it silently — the page offers to import it (see the import dialog),
 * so nobody's existing lists get overwritten by a board they were only trying out.
 */
const PREFIX = 'mawster-tierlist:'

export function readStored(name: string): string | null {
  try {
    return localStorage.getItem(PREFIX + name)
  } catch {
    // Storage blocked (private mode, site data disabled) — behave as if empty.
    return null
  }
}

export function writeStored(name: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + name, value)
  } catch {
    // Quota or blocked storage: the session stays usable, it just won't persist.
  }
}

export function removeStored(name: string): void {
  try {
    localStorage.removeItem(PREFIX + name)
  } catch {
    // Nothing to do — the value was never readable in the first place.
  }
}
