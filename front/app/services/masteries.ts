const PROXY = '/api/back';

const jsonHeaders: HeadersInit = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return;
  const data = await response.json().catch(() => ({}));
  const msg = (data as { detail?: string }).detail ?? fallback;
  const err = new Error(`Erreur ${response.status}: ${msg}`);
  (err as Error & { status: number }).status = response.status;
  throw err;
}

export interface MasteryEntry {
  id: string;
  mastery_id: string;
  mastery_name: string;
  mastery_max_value: number;
  mastery_order: number;
  unlocked: number;
  attack: number;
  defense: number;
}

export interface MasteryUpsertItem {
  mastery_id: string;
  unlocked: number;
  attack: number;
  defense: number;
}

export async function getMasteries(gameAccountId: string): Promise<MasteryEntry[]> {
  const response = await fetch(`${PROXY}/game-accounts/${gameAccountId}/masteries`, {
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors de la récupération des maîtrises');
  return response.json();
}

export async function saveMasteries(
  gameAccountId: string,
  items: MasteryUpsertItem[]
): Promise<MasteryEntry[]> {
  const response = await fetch(`${PROXY}/game-accounts/${gameAccountId}/masteries`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify(items),
  });
  await throwOnError(response, 'Erreur lors de la sauvegarde des maîtrises');
  return response.json();
}

// ─── Admin ───────────────────────────────────────────────

export interface MasteryDefinition {
  id: string;
  name: string;
  max_value: number;
  order: number;
}

export async function getAdminMasteries(): Promise<MasteryDefinition[]> {
  const response = await fetch(`${PROXY}/admin/masteries`, { headers: jsonHeaders });
  await throwOnError(response, 'Erreur lors de la récupération des maîtrises');
  return response.json();
}

export async function createAdminMastery(
  name: string,
  max_value: number,
  order: number
): Promise<MasteryDefinition> {
  const response = await fetch(`${PROXY}/admin/masteries`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ name, max_value, order }),
  });
  await throwOnError(response, 'Erreur lors de la création de la maîtrise');
  return response.json();
}

export async function updateAdminMastery(
  id: string,
  name: string,
  order: number
): Promise<MasteryDefinition> {
  const response = await fetch(`${PROXY}/admin/masteries/${id}`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ name, order }),
  });
  await throwOnError(response, 'Erreur lors de la mise à jour de la maîtrise');
  return response.json();
}

export async function deleteAdminMastery(id: string): Promise<void> {
  const response = await fetch(`${PROXY}/admin/masteries/${id}`, {
    method: 'DELETE',
    headers: jsonHeaders,
  });
  await throwOnError(response, 'Erreur lors de la suppression de la maîtrise');
}
