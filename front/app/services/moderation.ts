// ─── Moderation Service ──────────────────────────────────

const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return;
  const data = await response.json().catch(() => ({}));
  const msg = data.message ?? data.detail ?? fallback;
  const err = new Error(`Erreur ${response.status}: ${msg}`);
  (err as Error & { status: number }).status = response.status;
  throw err;
}

// ─── Types ───────────────────────────────────────────────

export type ReportStatus = 'pending' | 'resolved' | 'dismissed';

export interface NoteReport {
  id: string;
  note_id: string;
  alliance_id: string;
  alliance_name: string;
  battlegroup: number;
  node_number: number;
  note_content: string;
  reporter_pseudo: string;
  reason: string | null;
  status: string;
  created_at: string;
}

export interface PaginatedReports {
  items: NoteReport[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface NoteRevision {
  id: string;
  content: string;
  edited_by_user_id: string | null;
  edited_by_pseudo: string | null;
  edited_at: string;
}

export interface Mute {
  id: string;
  user_id: string;
  user_login: string;
  reason: string;
  created_at: string;
  expires_at: string | null;
  lifted_at: string | null;
  muted_by_login: string | null;
}

export interface Warn {
  id: string;
  user_id: string;
  user_login: string;
  reason: string;
  created_at: string;
  warned_by_login: string | null;
}

export interface MyModeration {
  mute: { reason: string; expires_at: string | null } | null;
  warns: { reason: string; created_at: string }[];
}

// ─── Reader API ──────────────────────────────────────────

export async function reportNote(noteId: string, reason?: string): Promise<void> {
  const response = await fetch(`${PROXY}/notes/${noteId}/report`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ reason: reason ?? null }),
  });
  await throwOnError(response, 'Failed to report note');
}

export async function getMyModeration(): Promise<MyModeration> {
  const response = await fetch(`${PROXY}/me/moderation`, { headers: jsonHeaders });
  await throwOnError(response, 'Failed to load moderation status');
  return response.json();
}

// ─── Admin API ───────────────────────────────────────────

export async function listReports(status?: string, page = 1): Promise<PaginatedReports> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('page', String(page));
  const suffix = params.toString() ? `?${params}` : '';
  const response = await fetch(`${PROXY}/admin/note-reports${suffix}`, { headers: jsonHeaders });
  await throwOnError(response, 'Failed to load note reports');
  return response.json();
}

export async function resolveReport(
  reportId: string,
  action: 'delete' | 'dismiss'
): Promise<void> {
  const response = await fetch(`${PROXY}/admin/note-reports/${reportId}/resolve`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ action }),
  });
  await throwOnError(response, 'Failed to resolve report');
}

export async function getRevisions(noteId: string): Promise<NoteRevision[]> {
  const response = await fetch(`${PROXY}/admin/notes/${noteId}/revisions`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to load note revisions');
  return response.json();
}

export async function muteUser(
  userId: string,
  reason: string,
  expiresAt?: string | null
): Promise<void> {
  const response = await fetch(`${PROXY}/admin/users/${userId}/mute`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ reason, expires_at: expiresAt ?? null }),
  });
  await throwOnError(response, 'Failed to mute user');
}

export async function liftMute(userId: string): Promise<void> {
  const response = await fetch(`${PROXY}/admin/users/${userId}/mute`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Failed to lift mute');
}

export async function warnUser(userId: string, reason: string): Promise<void> {
  const response = await fetch(`${PROXY}/admin/users/${userId}/warn`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ reason }),
  });
  await throwOnError(response, 'Failed to warn user');
}

export async function listMutes(activeOnly?: boolean): Promise<Mute[]> {
  const params = new URLSearchParams();
  if (activeOnly !== undefined) params.set('active_only', String(activeOnly));
  const suffix = params.toString() ? `?${params}` : '';
  const response = await fetch(`${PROXY}/admin/mutes${suffix}`, { headers: jsonHeaders });
  await throwOnError(response, 'Failed to load mutes');
  return response.json();
}

export async function listWarns(userId?: string): Promise<Warn[]> {
  const params = new URLSearchParams();
  if (userId) params.set('user_id', userId);
  const suffix = params.toString() ? `?${params}` : '';
  const response = await fetch(`${PROXY}/admin/warns${suffix}`, { headers: jsonHeaders });
  await throwOnError(response, 'Failed to load warns');
  return response.json();
}
