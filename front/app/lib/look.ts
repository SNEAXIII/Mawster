/** Visual identity ("look"), orthogonal to the light/dark theme — set as data-look on <html>. */
export const LOOKS = [
  { value: 'classic', label: 'Classic' },
  { value: 'new-a', label: 'Midnight sky' },
  { value: 'new-b', label: 'Abyss ice' },
  { value: 'new-c', label: 'Slate azure' },
] as const
export type Look = (typeof LOOKS)[number]['value']

export const DEFAULT_LOOK: Look = 'new-a'

/** Offered to players; the other candidates stay in /dev/components only. */
export const PLAYER_LOOKS = LOOKS.filter((l) => l.value === DEFAULT_LOOK || l.value === 'classic')

const STORAGE_KEY = 'look'

function isLook(value: string | null | undefined): value is Look {
  return LOOKS.some((l) => l.value === value)
}

export function readLook(): Look {
  const current = document.documentElement.dataset.look
  return isLook(current) ? current : DEFAULT_LOOK
}

export function applyLook(look: Look) {
  document.documentElement.dataset.look = look
  try {
    if (look === DEFAULT_LOOK) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, look)
  } catch {
    // Storage blocked (private mode): the look still applies for this page view.
  }
}

/** Re-applies a stored non-default look after hydration (<html> is rendered with the default). */
export function restoreStoredLook() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLook(stored)) document.documentElement.dataset.look = stored
  } catch {
    // Storage blocked: keep the default.
  }
}
