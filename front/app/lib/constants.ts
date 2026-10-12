// ─── Dashboard filter constants ──────────────────────────
// Shared between UI components and service layer

export const possibleStatus = [
  { value: 'all', label: 'all' },
  { value: 'enabled', label: 'enabled' },
  { value: 'disabled', label: 'disabled' },
  { value: 'deleted', label: 'deleted' },
]

export const ROLES = ['user', 'admin', 'super_admin'] as const
export type Role = (typeof ROLES)[number]

export const possibleRoles = [
  { value: 'all', label: 'all' },
  ...ROLES.map((role) => ({ value: role, label: role })),
]
