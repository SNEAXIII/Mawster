/** Browser storage for the tier lists and the display preferences. */
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
