import { type ChangeEvent, useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import {
  RosterEntry,
  bulkUpdateRoster,
  getRoster,
  BulkChampionEntry,
  raritySortValue,
  searchChampions,
} from '@/app/services/roster';
import { type ImportResult } from '@/components/roster/import-report-dialog';
import { type PreviewRow } from '@/components/roster/import-preview-row';

// ─── Export format (simplified) ──────────────────────────
export interface RosterExportEntry {
  champion_name: string;
  rarity: string;
  signature: number;
  is_preferred_attacker: boolean;
  ascension: number;
}

// ─── Validation helpers ──────────────────────────────────

function validateEntry(
  obj: Record<string, unknown>,
  idx: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
): { entry?: RosterExportEntry; error?: string } {
  if (!obj.champion_name || typeof obj.champion_name !== 'string') {
    return { error: t.roster.importExport.missingChampionName.replace('{idx}', String(idx)) };
  }
  if (!obj.rarity || typeof obj.rarity !== 'string') {
    return { error: t.roster.importExport.missingRarity.replace('{idx}', String(idx)) };
  }
  if (!/^[67]r[1-5]$/.exec(obj.rarity)) {
    return {
      error: t.roster.importExport.invalidRarity
        .replace('{idx}', String(idx))
        .replace('{name}', obj.champion_name)
        .replace('{rarity}', obj.rarity),
    };
  }
  if (obj.signature !== undefined && (typeof obj.signature !== 'number' || obj.signature < 0)) {
    return {
      error: t.roster.importExport.invalidSignature
        .replace('{idx}', String(idx))
        .replace('{name}', obj.champion_name),
    };
  }

  return {
    entry: {
      champion_name: obj.champion_name,
      rarity: obj.rarity,
      signature: typeof obj.signature === 'number' ? obj.signature : 0,
      is_preferred_attacker: obj.is_preferred_attacker === true,
      ascension:
        typeof obj.ascension === 'number' && obj.ascension >= 0 && obj.ascension <= 2
          ? obj.ascension
          : 0,
    },
  };
}

function parseAndValidateEntries(
  parsed: unknown[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
): { entries: RosterExportEntry[]; errors: string[] } {
  const entries: RosterExportEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const idx = i + 1;

    if (!item || typeof item !== 'object') {
      errors.push(t.roster.importExport.entryNotObject.replace('{idx}', String(idx)));
      continue;
    }

    const result = validateEntry(item as Record<string, unknown>, idx, t);
    if (result.error) {
      errors.push(result.error);
    } else if (result.entry) {
      entries.push(result.entry);
    }
  }

  return { entries, errors };
}

function deduplicateEntries(entries: RosterExportEntry[]): RosterExportEntry[] {
  const deduped = new Map<string, RosterExportEntry>();
  for (const entry of entries) {
    const stars = entry.rarity.charAt(0);
    const key = `${entry.champion_name.toLowerCase()}_${stars}`;
    deduped.set(key, entry);
  }
  return Array.from(deduped.values());
}

async function fetchChampionLookup(
  uniqueEntries: RosterExportEntry[],
  roster: RosterEntry[]
): Promise<Map<string, { champion_class: string; image_url: string | null }>> {
  const championLookup = new Map<string, { champion_class: string; image_url: string | null }>();
  const unknownNames = new Set<string>();
  for (const entry of uniqueEntries) {
    const found = roster.find(
      (r) => r.champion_name.toLowerCase() === entry.champion_name.toLowerCase()
    );
    if (!found) unknownNames.add(entry.champion_name);
  }

  if (unknownNames.size > 0) {
    try {
      const res = await searchChampions('', 9999);
      for (const c of res.champions) {
        championLookup.set(c.name.toLowerCase(), {
          champion_class: c.champion_class,
          image_url: c.image_url,
        });
      }
    } catch {
      // search failed — previews will just lack metadata
    }
  }
  return championLookup;
}

function parseJsonFile(
  text: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any
): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new TypeError(t.roster.importExport.invalidJson);
  }

  if (!Array.isArray(parsed)) {
    throw new TypeError(t.roster.importExport.notArray);
  }

  if (parsed.length === 0) {
    throw new TypeError(t.roster.importExport.emptyFile);
  }

  return parsed;
}

function buildPreviewRow(
  entry: RosterExportEntry,
  roster: RosterEntry[],
  championLookup: Map<string, { champion_class: string; image_url: string | null }>
): PreviewRow {
  const stars = entry.rarity.charAt(0);
  const existing = roster.find(
    (r) =>
      r.champion_name.toLowerCase() === entry.champion_name.toLowerCase() &&
      r.rarity.startsWith(stars)
  );

  const isNew = !existing;
  const hasChanges =
    existing != null &&
    (existing.rarity !== entry.rarity ||
      existing.signature !== entry.signature ||
      existing.is_preferred_attacker !== entry.is_preferred_attacker ||
      (existing.ascension ?? 0) !== entry.ascension);

  const rosterMatch = roster.find(
    (r) => r.champion_name.toLowerCase() === entry.champion_name.toLowerCase()
  );
  const apiMatch = championLookup.get(entry.champion_name.toLowerCase());

  return {
    champion_name: entry.champion_name,
    champion_class: rosterMatch?.champion_class ?? apiMatch?.champion_class ?? null,
    image_url: rosterMatch?.image_url ?? apiMatch?.image_url ?? null,
    newRarity: entry.rarity,
    newSignature: entry.signature,
    oldRarity: existing?.rarity ?? null,
    oldSignature: existing?.signature ?? null,
    isNew,
    hasChanges,
    is_preferred_attacker: entry.is_preferred_attacker,
    ascension: entry.ascension,
  };
}

// ─── Hook ─────────────────────────────────────────────────

export interface UseRosterImportExportProps {
  roster: RosterEntry[];
  selectedAccountId: string;
  selectedAccountName: string;
  onRosterUpdated: (roster: RosterEntry[]) => void;
}

export function useRosterImportExport({
  roster,
  selectedAccountId,
  selectedAccountName,
  onRosterUpdated,
}: UseRosterImportExportProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);

  // Report dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  // ── Export ─────────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (roster.length === 0) {
      toast.warning(t.roster.importExport.emptyExport);
      return;
    }

    const data: RosterExportEntry[] = roster.map((e) => ({
      champion_name: e.champion_name,
      rarity: e.rarity,
      signature: e.signature,
      is_preferred_attacker: e.is_preferred_attacker,
      ascension: e.ascension ?? 0,
    }));

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = selectedAccountName.replaceAll(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `roster_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    toast.success(t.roster.importExport.exportedCount.replace('{count}', String(data.length)));
  }, [roster, selectedAccountName, t]);

  // ── Import: parse + validate + build preview ───────────
  const handleFileSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset file input so same file can be re-selected
      e.target.value = '';

      try {
        const text = await file.text();
        const parsed = parseJsonFile(text, t);
        const { entries, errors } = parseAndValidateEntries(parsed, t);

        if (errors.length > 0 && entries.length === 0) {
          throw new TypeError(`${t.roster.importExport.allInvalid}\n${errors.join('\n')}`);
        }

        if (errors.length > 0) {
          toast.warning(
            t.roster.importExport.skippedEntries.replace('{count}', String(errors.length))
          );
        }

        const uniqueEntries = deduplicateEntries(entries);
        const championLookup = await fetchChampionLookup(uniqueEntries, roster);

        const rows: PreviewRow[] = uniqueEntries.map((entry) =>
          buildPreviewRow(entry, roster, championLookup)
        );

        // Sort: new first, then changes, then unchanged
        rows.sort((a, b) => {
          if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
          if (a.hasChanges !== b.hasChanges) return a.hasChanges ? -1 : 1;
          return raritySortValue(b.newRarity) - raritySortValue(a.newRarity);
        });

        setPreviewRows(rows);
        setPreviewOpen(true);
      } catch (err: unknown) {
        toast.error((err as Error).message || t.roster.importExport.fileReadError);
      }
    },
    [roster, t]
  );

  // ── Execute import via bulk API ────────────────────────
  const executeImport = useCallback(async () => {
    if (previewRows.length === 0) return;
    setImporting(true);

    const results: ImportResult[] = [];

    try {
      // Only send entries that are new or have changes
      const toSend = previewRows.filter((r) => r.isNew || r.hasChanges);

      if (toSend.length === 0) {
        toast.info(t.roster.importExport.noChanges);
        setPreviewOpen(false);
        setImporting(false);
        return;
      }

      const champions: BulkChampionEntry[] = toSend.map((r) => ({
        champion_name: r.champion_name,
        rarity: r.newRarity,
        signature: r.newSignature,
        is_preferred_attacker: r.is_preferred_attacker ?? false,
        ascension: r.ascension ?? 0,
      }));

      try {
        await bulkUpdateRoster(selectedAccountId, champions);

        // All succeeded (bulk is atomic) — build rich results
        for (const row of toSend) {
          results.push({
            champion_name: row.champion_name,
            success: true,
            isNew: row.isNew,
            isSkipped: false,
            champion_class: row.champion_class,
            image_url: row.image_url,
            newRarity: row.newRarity,
            newSignature: row.newSignature,
            oldRarity: row.oldRarity,
            oldSignature: row.oldSignature,
          });
        }

        // Mark unchanged entries as skipped
        for (const row of previewRows.filter((r) => !r.isNew && !r.hasChanges)) {
          results.push({
            champion_name: row.champion_name,
            success: true,
            isNew: false,
            isSkipped: true,
            champion_class: row.champion_class,
            image_url: row.image_url,
            newRarity: row.newRarity,
            newSignature: row.newSignature,
            oldRarity: row.oldRarity,
            oldSignature: row.oldSignature,
          });
        }
      } catch (err) {
        // Bulk failed entirely
        for (const row of previewRows) {
          results.push({
            champion_name: row.champion_name,
            success: false,
            isNew: row.isNew,
            isSkipped: false,
            champion_class: row.champion_class,
            image_url: row.image_url,
            newRarity: row.newRarity,
            newSignature: row.newSignature,
            oldRarity: row.oldRarity,
            oldSignature: row.oldSignature,
            error: (err instanceof Error ? err.message : undefined) || t.roster.importExport.serverError,
          });
        }
      }

      // Refresh roster
      try {
        const updated = await getRoster(selectedAccountId);
        onRosterUpdated(updated);
      } catch {
        // roster refresh failed, not critical
      }
    } finally {
      setImporting(false);
      setPreviewOpen(false);
      setImportResults(results);
      setReportOpen(true);
    }
  }, [previewRows, selectedAccountId, onRosterUpdated, t]);

  return {
    fileInputRef,
    previewOpen,
    setPreviewOpen,
    previewRows,
    importing,
    reportOpen,
    setReportOpen,
    importResults,
    handleExport,
    handleFileSelected,
    executeImport,
  };
}
