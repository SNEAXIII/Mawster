// ─── Types ───────────────────────────────────────────────
export interface Champion {
  id: string;
  name: string;
  champion_class: string;
  image_url: string | null;
  is_7_star: boolean;
  alias: string | null;
}

export interface FetchChampionsResponse {
  champions: Champion[];
  total_champions: number;
  total_pages: number;
  current_page: number;
}

interface ApiError {
  detail?: string;
  message?: string;
  statusCode?: number;
}

// ─── Helpers ─────────────────────────────────────────────
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

// ─── Champion classes ────────────────────────────────────
export const championClasses = [
  { value: 'all', label: 'All' },
  { value: 'Science', label: 'Science' },
  { value: 'Cosmic', label: 'Cosmic' },
  { value: 'Mutant', label: 'Mutant' },
  { value: 'Skill', label: 'Skill' },
  { value: 'Tech', label: 'Tech' },
  { value: 'Mystic', label: 'Mystic' },
];

// ─── API ─────────────────────────────────────────────────
export const getChampions = async (
  page: number = 1,
  size: number = 20,
  championClass: string | null = null,
  search: string | null = null,
): Promise<FetchChampionsResponse> => {
  const qs = new URLSearchParams({ page: String(page), size: String(size) });
  if (championClass && championClass !== 'all') qs.set('champion_class', championClass);
  if (search && search.trim()) qs.set('search', search.trim());

  const response = await fetch(`${PROXY}/admin/champions?${qs}`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des champions');
  return response.json();
};

export const updateChampionAlias = async (
  championId: string,
  alias: string | null,
): Promise<void> => {
  const response = await fetch(`${PROXY}/admin/champions/${championId}/alias`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({ alias }),
  });
  await throwOnError(response, "Erreur lors de la mise à jour de l'alias");
};

export const loadChampions = async (
  champions: { name: string; champion_class: string; image_filename: string | null }[],
): Promise<{ message: string; created: number; updated: number; skipped: number }> => {
  const response = await fetch(`${PROXY}/admin/champions/load`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(champions),
  });
  await throwOnError(response, 'Erreur lors du chargement des champions');
  return response.json();
};

export const deleteChampion = async (championId: string): Promise<void> => {
  const response = await fetch(`${PROXY}/admin/champions/${championId}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors de la suppression du champion');
};
