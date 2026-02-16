import { possibleRoles, possibleStatus } from '@/app/ui/dashboard/table/table-header';

// ─── Types ───────────────────────────────────────────────
export interface User {
  login: string;
  email: string;
  role: string;
  id: string;
  created_at: string;
  last_login_date: string | null;
  disabled_at: string | null;
  deleted_at: string | null;
}

export interface FetchUsersResponse {
  users: User[];
  total_users: number;
  total_pages: number;
  current_page: number;
}

interface ApiError {
  detail?: string;
  message?: string;
  statusCode?: number;
}

export interface ValidationErrors {
  [key: string]: { type: string; message: string };
}

export interface ApiErrorResponse {
  message: string;
  errors: ValidationErrors;
}

// ─── Helpers ─────────────────────────────────────────────
// Tous les appels passent par le proxy Next.js /api/back
// Le JWT backend est injecté côté serveur, jamais côté client.
const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return;
  const data: ApiError = await response.json().catch(() => ({}));
  const msg = data.message ?? data.detail ?? fallback;
  const err = new Error(`Erreur ${response.status}: ${msg}`);
  (err as any).status = response.status;
  throw err;
}

// ─── API ─────────────────────────────────────────────────
export const getUsers = async (
  page: number = 1,
  size: number = 10,
  status: string | null = null,
  role: string | null = null,
): Promise<FetchUsersResponse> => {
  const qs = new URLSearchParams({ page: String(page), size: String(size) });
  if (status && status !== possibleStatus[0].value) qs.set('status', status);
  if (role && role !== possibleRoles[0].value) qs.set('role', role);

  const response = await fetch(`${PROXY}/admin/users?${qs}`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des utilisateurs');
  return response.json();
};

export const deleteAccount = async (confirmation?: string): Promise<true> => {
  const response = await fetch(`${PROXY}/user/delete`, {
    method: 'DELETE',
    headers: jsonHeaders,
    body: JSON.stringify({ confirmation: confirmation ?? '' }),
  });
  await throwOnError(response, 'Erreur lors de la suppression du compte');
  return true;
};

export const disableUser = async (userId: string): Promise<true> => {
  const response = await fetch(`${PROXY}/admin/users/disable/${userId}`, {
    method: 'PATCH',
    headers: jsonHeaders,
  });
  await throwOnError(response, "Erreur lors de la désactivation de l'utilisateur");
  return true;
};

export const enableUser = async (userId: string): Promise<true> => {
  const response = await fetch(`${PROXY}/admin/users/enable/${userId}`, {
    method: 'PATCH',
    headers: jsonHeaders,
  });
  await throwOnError(response, "Erreur lors de la réactivation de l'utilisateur");
  return true;
};

export const deleteUser = async (userId: string): Promise<true> => {
  const response = await fetch(`${PROXY}/admin/users/delete/${userId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, "Erreur lors de la suppression de l'utilisateur");
  return true;
};

export const promoteToAdmin = async (userId: string): Promise<true> => {
  const response = await fetch(`${PROXY}/admin/users/promote/${userId}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ user_uuid_to_promote: userId }),
  });
  if (!response.ok) {
    const errorData: ApiErrorResponse = await response.json().catch(() => ({
      message: 'Erreur lors de la promotion en administrateur',
      errors: {},
    }));
    const error = new Error(
      errorData.message ?? 'Erreur lors de la promotion en administrateur'
    ) as Error & { validationErrors?: ValidationErrors };
    error.validationErrors = errorData.errors;
    throw error;
  }
  return true;
};
