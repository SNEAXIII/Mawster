'use client';

import React, { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { FiDownload, FiUpload, FiArrowRight, FiCheck, FiX, FiAlertTriangle } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ChampionPortrait from '@/components/champion-portrait';
import {
  RosterEntry,
  bulkAddToRoster,
  getRoster,
  BulkChampionEntry,
  RARITY_LABELS,
  shortenChampionName,
  getClassColors,
  raritySortValue,
} from '@/app/services/roster';
import { getChampionImageUrl } from '@/app/services/champions';

// ─── Export format ───────────────────────────────────────
export interface RosterExportEntry {
  champion_id: string;
  champion_name: string;
  champion_class: string;
  rarity: string;
  signature: number;
  image_url: string | null;
}

// ─── Preview row ─────────────────────────────────────────
interface PreviewRow {
  champion_id: string;
  champion_name: string;
  champion_class: string;
  image_url: string | null;
  // imported data
  newRarity: string;
  newSignature: number;
  // existing data (null = NEW)
  oldRarity: string | null;
  oldSignature: number | null;
  isNew: boolean;
  hasChanges: boolean;
}

// ─── Import result per entry ─────────────────────────────
interface ImportResult {
  champion_name: string;
  success: boolean;
  isNew: boolean;
  error?: string;
}

// ─── Props ───────────────────────────────────────────────
interface RosterImportExportProps {
  roster: RosterEntry[];
  selectedAccountId: string;
  onRosterUpdated: (roster: RosterEntry[]) => void;
}

export default function RosterImportExport({
  roster,
  selectedAccountId,
  onRosterUpdated,
}: RosterImportExportProps) {
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
      toast.warning('Roster vide, rien à exporter');
      return;
    }

    const data: RosterExportEntry[] = roster.map((e) => ({
      champion_id: e.champion_id,
      champion_name: e.champion_name,
      champion_class: e.champion_class,
      rarity: e.rarity,
      signature: e.signature,
      image_url: e.image_url,
    }));

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roster_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`${data.length} champion(s) exporté(s)`);
  }, [roster]);

  // ── Import: parse + validate + build preview ───────────
  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset file input so same file can be re-selected
      e.target.value = '';

      try {
        const text = await file.text();
        let parsed: unknown;

        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('Le fichier n\'est pas un JSON valide.');
        }

        if (!Array.isArray(parsed)) {
          throw new Error('Le JSON doit être un tableau de champions.');
        }

        if (parsed.length === 0) {
          throw new Error('Le fichier ne contient aucun champion.');
        }

        // Validate each entry
        const entries: RosterExportEntry[] = [];
        const errors: string[] = [];

        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          const idx = i + 1;

          if (!item || typeof item !== 'object') {
            errors.push(`Entrée #${idx}: doit être un objet.`);
            continue;
          }

          const obj = item as Record<string, unknown>;

          if (!obj.champion_id || typeof obj.champion_id !== 'string') {
            errors.push(`Entrée #${idx}: "champion_id" manquant ou invalide.`);
            continue;
          }
          if (!obj.champion_name || typeof obj.champion_name !== 'string') {
            errors.push(`Entrée #${idx}: "champion_name" manquant ou invalide.`);
            continue;
          }
          if (!obj.rarity || typeof obj.rarity !== 'string') {
            errors.push(`Entrée #${idx}: "rarity" manquant ou invalide.`);
            continue;
          }
          if (!obj.rarity.match(/^[67]r[1-5]$/)) {
            errors.push(`Entrée #${idx} (${obj.champion_name}): rarity "${obj.rarity}" invalide (attendu 6r4, 7r1, etc.).`);
            continue;
          }
          if (obj.signature !== undefined && (typeof obj.signature !== 'number' || obj.signature < 0)) {
            errors.push(`Entrée #${idx} (${obj.champion_name}): "signature" doit être un nombre >= 0.`);
            continue;
          }

          entries.push({
            champion_id: obj.champion_id as string,
            champion_name: obj.champion_name as string,
            champion_class: (obj.champion_class as string) || 'Unknown',
            rarity: obj.rarity as string,
            signature: (typeof obj.signature === 'number' ? obj.signature : 0),
            image_url: (obj.image_url as string | null) ?? null,
          });
        }

        if (errors.length > 0 && entries.length === 0) {
          throw new Error(`Toutes les entrées sont invalides:\n${errors.join('\n')}`);
        }

        if (errors.length > 0) {
          toast.warning(`${errors.length} entrée(s) ignorée(s) car invalide(s).`);
        }

        // Deduplicate: keep last occurrence per (champion_id, stars)
        const deduped = new Map<string, RosterExportEntry>();
        for (const entry of entries) {
          const stars = entry.rarity.charAt(0);
          const key = `${entry.champion_id}_${stars}`;
          deduped.set(key, entry);
        }
        const uniqueEntries = Array.from(deduped.values());

        // Build preview rows
        const rows: PreviewRow[] = uniqueEntries.map((entry) => {
          // Find existing entry in current roster matching champion_id + star level
          const stars = entry.rarity.charAt(0);
          const existing = roster.find(
            (r) => r.champion_id === entry.champion_id && r.rarity.charAt(0) === stars,
          );

          const isNew = !existing;
          const hasChanges = !isNew && (
            existing!.rarity !== entry.rarity || existing!.signature !== entry.signature
          );

          return {
            champion_id: entry.champion_id,
            champion_name: entry.champion_name,
            champion_class: entry.champion_class,
            image_url: entry.image_url,
            newRarity: entry.rarity,
            newSignature: entry.signature,
            oldRarity: existing?.rarity ?? null,
            oldSignature: existing?.signature ?? null,
            isNew,
            hasChanges,
          };
        });

        // Sort: new first, then changes, then unchanged
        rows.sort((a, b) => {
          if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
          if (a.hasChanges !== b.hasChanges) return a.hasChanges ? -1 : 1;
          return raritySortValue(b.newRarity) - raritySortValue(a.newRarity);
        });

        setPreviewRows(rows);
        setPreviewOpen(true);
      } catch (err: any) {
        toast.error(err.message || 'Erreur lors de la lecture du fichier');
      }
    },
    [roster],
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
        toast.info('Aucun changement à appliquer.');
        setPreviewOpen(false);
        setImporting(false);
        return;
      }

      const champions: BulkChampionEntry[] = toSend.map((r) => ({
        champion_id: r.champion_id,
        rarity: r.newRarity,
        signature: r.newSignature,
      }));

      try {
        await bulkAddToRoster(selectedAccountId, champions);

        // All succeeded (bulk is atomic)
        for (const row of toSend) {
          results.push({
            champion_name: row.champion_name,
            success: true,
            isNew: row.isNew,
          });
        }

        // Also mark unchanged entries as success (no-op)
        for (const row of previewRows.filter((r) => !r.isNew && !r.hasChanges)) {
          results.push({
            champion_name: row.champion_name,
            success: true,
            isNew: false,
          });
        }
      } catch (err: any) {
        // Bulk failed entirely
        for (const row of previewRows) {
          results.push({
            champion_name: row.champion_name,
            success: false,
            isNew: row.isNew,
            error: err.message || 'Erreur serveur',
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
  }, [previewRows, selectedAccountId, onRosterUpdated]);

  // ── Summary counts ─────────────────────────────────────
  const previewNewCount = previewRows.filter((r) => r.isNew).length;
  const previewChangeCount = previewRows.filter((r) => !r.isNew && r.hasChanges).length;
  const previewUnchangedCount = previewRows.filter((r) => !r.isNew && !r.hasChanges).length;

  const reportSuccessCount = importResults.filter((r) => r.success).length;
  const reportFailCount = importResults.filter((r) => !r.success).length;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Export / Import buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FiDownload className="mr-1.5" size={14} />
          Export JSON
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <FiUpload className="mr-1.5" size={14} />
          Import JSON
        </Button>
      </div>

      {/* ── Import Preview Dialog ─────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Aperçu de l&apos;import</DialogTitle>
            <DialogDescription>
              {previewRows.length} champion(s) détecté(s) —{' '}
              <span className="text-green-600 font-medium">{previewNewCount} nouveau(x)</span>,{' '}
              <span className="text-blue-600 font-medium">{previewChangeCount} mise(s) à jour</span>,{' '}
              <span className="text-gray-500">{previewUnchangedCount} inchangé(s)</span>
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 -mx-6 px-6">
            {previewRows.map((row) => (
              <div
                key={`${row.champion_id}_${row.newRarity}`}
                className={`py-2.5 flex items-center gap-3 ${
                  row.isNew
                    ? 'bg-green-50 dark:bg-green-950/30'
                    : row.hasChanges
                      ? 'bg-blue-50 dark:bg-blue-950/30'
                      : ''
                }`}
              >
                {/* Champion portrait */}
                <div className="shrink-0">
                  <ChampionPortrait
                    imageUrl={row.image_url}
                    name={row.champion_name}
                    rarity={row.newRarity}
                    size={40}
                  />
                </div>

                {/* Name & class */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" title={row.champion_name}>
                    {shortenChampionName(row.champion_name)}
                  </p>
                  <p className={`text-xs ${getClassColors(row.champion_class).text}`}>
                    {row.champion_class}
                  </p>
                </div>

                {/* Status badge + diff */}
                <div className="shrink-0 text-right text-xs whitespace-nowrap">
                  {row.isNew ? (
                    <div>
                      <span className="inline-flex items-center gap-1 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-0.5">
                        NEW
                      </span>
                      <div className="text-gray-600 dark:text-gray-300">
                        {RARITY_LABELS[row.newRarity] ?? row.newRarity} · sig {row.newSignature}
                      </div>
                    </div>
                  ) : row.hasChanges ? (
                    <div className="space-y-0.5">
                      {/* Rarity diff */}
                      {row.oldRarity !== row.newRarity && (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-gray-400">{RARITY_LABELS[row.oldRarity!] ?? row.oldRarity}</span>
                          <FiArrowRight className="text-blue-500" size={10} />
                          <span className="text-blue-600 font-semibold">{RARITY_LABELS[row.newRarity] ?? row.newRarity}</span>
                        </div>
                      )}
                      {row.oldRarity === row.newRarity && (
                        <div className="text-gray-500">{RARITY_LABELS[row.newRarity] ?? row.newRarity}</div>
                      )}
                      {/* Signature diff */}
                      {row.oldSignature !== row.newSignature && (
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-gray-400">sig {row.oldSignature}</span>
                          <FiArrowRight className="text-blue-500" size={10} />
                          <span className="text-blue-600 font-semibold">sig {row.newSignature}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic">inchangé</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={importing}>
              Annuler
            </Button>
            <Button onClick={executeImport} disabled={importing || (previewChangeCount + previewNewCount === 0)}>
              {importing ? 'Import en cours…' : `Importer ${previewNewCount + previewChangeCount} champion(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Report Dialog ──────────────────────── */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Compte-rendu de l&apos;import</DialogTitle>
            <DialogDescription className="flex items-center gap-3">
              {reportSuccessCount > 0 && (
                <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                  <FiCheck size={14} /> {reportSuccessCount} réussi(s)
                </span>
              )}
              {reportFailCount > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                  <FiX size={14} /> {reportFailCount} échoué(s)
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 -mx-6 px-6">
            {importResults.map((result, idx) => (
              <div
                key={idx}
                className={`py-2 flex items-center gap-3 ${
                  result.success ? '' : 'bg-red-50 dark:bg-red-950/30'
                }`}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {result.success ? (
                    <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <FiCheck className="text-green-600" size={12} />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                      <FiX className="text-red-600" size={12} />
                    </div>
                  )}
                </div>

                {/* Champion name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {shortenChampionName(result.champion_name)}
                  </p>
                  {result.error && (
                    <p className="text-xs text-red-500 truncate" title={result.error}>
                      {result.error}
                    </p>
                  )}
                </div>

                {/* Badge */}
                <div className="shrink-0">
                  {result.success ? (
                    result.isNew ? (
                      <span className="text-[10px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded-full">
                        AJOUTÉ
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                        MIS À JOUR
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <FiAlertTriangle size={9} /> ERREUR
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button onClick={() => setReportOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
