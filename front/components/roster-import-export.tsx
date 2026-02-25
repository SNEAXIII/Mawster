'use client';

import React, { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { FiDownload, FiUpload } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import {
  RosterEntry,
  bulkUpdateRoster,
  getRoster,
  BulkChampionEntry,
  raritySortValue,
  searchChampions,
} from '@/app/services/roster';
import ImportPreviewDialog from '@/components/roster/import-preview-dialog';
import ImportReportDialog, { type ImportResult } from '@/components/roster/import-report-dialog';
import { type PreviewRow } from '@/components/roster/import-preview-row';

// ─── Export format (simplified) ──────────────────────────
export interface RosterExportEntry {
  champion_name: string;
  rarity: string;
  signature: number;
}

// ─── Props ───────────────────────────────────────────────
interface RosterImportExportProps {
  roster: RosterEntry[];
  selectedAccountId: string;
  selectedAccountName: string;
  onRosterUpdated: (roster: RosterEntry[]) => void;
}

export default function RosterImportExport({
  roster,
  selectedAccountId,
  selectedAccountName,
  onRosterUpdated,
}: RosterImportExportProps) {
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
    }));

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = selectedAccountName.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `roster_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(t.roster.importExport.exportedCount.replace('{count}', String(data.length)));
  }, [roster, t]);

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
          throw new Error(t.roster.importExport.invalidJson);
        }

        if (!Array.isArray(parsed)) {
          throw new Error(t.roster.importExport.notArray);
        }

        if (parsed.length === 0) {
          throw new Error(t.roster.importExport.emptyFile);
        }

        // Validate each entry
        const entries: RosterExportEntry[] = [];
        const errors: string[] = [];

        for (let i = 0; i < parsed.length; i++) {
          const item = parsed[i];
          const idx = i + 1;

          if (!item || typeof item !== 'object') {
            errors.push(t.roster.importExport.entryNotObject.replace('{idx}', String(idx)));
            continue;
          }

          const obj = item as Record<string, unknown>;

          if (!obj.champion_name || typeof obj.champion_name !== 'string') {
            errors.push(t.roster.importExport.missingChampionName.replace('{idx}', String(idx)));
            continue;
          }
          if (!obj.rarity || typeof obj.rarity !== 'string') {
            errors.push(t.roster.importExport.missingRarity.replace('{idx}', String(idx)));
            continue;
          }
          if (!obj.rarity.match(/^[67]r[1-5]$/)) {
            errors.push(t.roster.importExport.invalidRarity.replace('{idx}', String(idx)).replace('{name}', obj.champion_name as string).replace('{rarity}', obj.rarity as string));
            continue;
          }
          if (obj.signature !== undefined && (typeof obj.signature !== 'number' || obj.signature < 0)) {
            errors.push(t.roster.importExport.invalidSignature.replace('{idx}', String(idx)).replace('{name}', obj.champion_name as string));
            continue;
          }

          entries.push({
            champion_name: obj.champion_name as string,
            rarity: obj.rarity as string,
            signature: (typeof obj.signature === 'number' ? obj.signature : 0),
          });
        }

        if (errors.length > 0 && entries.length === 0) {
          throw new Error(`${t.roster.importExport.allInvalid}\n${errors.join('\n')}`);
        }

        if (errors.length > 0) {
          toast.warning(t.roster.importExport.skippedEntries.replace('{count}', String(errors.length)));
        }

        // Deduplicate: keep last occurrence per (champion_name, stars)
        const deduped = new Map<string, RosterExportEntry>();
        for (const entry of entries) {
          const stars = entry.rarity.charAt(0);
          const key = `${entry.champion_name.toLowerCase()}_${stars}`;
          deduped.set(key, entry);
        }
        const uniqueEntries = Array.from(deduped.values());

        // Build preview rows
        // First, resolve champion details for entries not in the roster
        const unknownNames = new Set<string>();
        for (const entry of uniqueEntries) {
          const found = roster.find(
            (r) => r.champion_name.toLowerCase() === entry.champion_name.toLowerCase(),
          );
          if (!found) unknownNames.add(entry.champion_name);
        }

        // Batch-fetch unknown champions from the API
        const championLookup = new Map<string, { champion_class: string; image_url: string | null }>();
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

        const rows: PreviewRow[] = uniqueEntries.map((entry) => {
          // Find existing entry in current roster matching champion_name + star level
          const stars = entry.rarity.charAt(0);
          const existing = roster.find(
            (r) => r.champion_name.toLowerCase() === entry.champion_name.toLowerCase() && r.rarity.charAt(0) === stars,
          );

          const isNew = !existing;
          const hasChanges = !isNew && (
            existing!.rarity !== entry.rarity || existing!.signature !== entry.signature
          );

          // Resolve champion class and image from the roster or API lookup
          const rosterMatch = roster.find(
            (r) => r.champion_name.toLowerCase() === entry.champion_name.toLowerCase(),
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
        toast.error(err.message || t.roster.importExport.fileReadError);
      }
    },
    [roster, t],
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
      } catch (err: any) {
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
            error: err.message || t.roster.importExport.serverError,
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
          {t.roster.importExport.exportJson}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <FiUpload className="mr-1.5" size={14} />
          {t.roster.importExport.importJson}
        </Button>
      </div>

      <ImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        previewRows={previewRows}
        importing={importing}
        onImport={executeImport}
      />

      <ImportReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        results={importResults}
      />
    </>
  );
}
