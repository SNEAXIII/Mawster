// ─── Dashboard filter constants ──────────────────────────
// Shared between UI components and service layer

export const possibleStatus = [
  { value: 'all', label: 'all' },
  { value: 'enabled', label: 'enabled' },
  { value: 'disabled', label: 'disabled' },
  { value: 'deleted', label: 'deleted' },
];

export const possibleRoles = [
  { value: 'all', label: 'all' },
  { value: 'user', label: 'user' },
  { value: 'admin', label: 'admin' },
  { value: 'super_admin', label: 'super_admin' },
];
