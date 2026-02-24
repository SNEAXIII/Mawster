'use client';

import React, { useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
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
  bulkUpdateRoster,
  getRoster,
  BulkChampionEntry,
  RARITY_LABELS,
  shortenChampionName,
  getClassColors,
  raritySortValue,
} from '@/app/services/roster';
import { getChampionImageUrl } from '@/app/services/champions';

// ─── Export format (simplified) ──────────────────────────
export interface RosterExportEntry {
  champion_name: string;
  rarity: string;
  signature: number;
}

// ─── Preview row ─────────────────────────────────────────
interface PreviewRow {
  champion_name: string;
  champion_class: string | null;
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
    a.download = `roster_export_${new Date().toISOString().slice(0, 10)}.json`;
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

          // Resolve champion class and image from the roster (any star level)
          const rosterMatch = roster.find(
            (r) => r.champion_name.toLowerCase() === entry.champion_name.toLowerCase(),
          );

          return {
            champion_name: entry.champion_name,
            champion_class: rosterMatch?.champion_class ?? null,
            image_url: rosterMatch?.image_url ?? null,
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
          {t.roster.importExport.exportJson}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <FiUpload className="mr-1.5" size={14} />
          {t.roster.importExport.importJson}
        </Button>
      </div>

      {/* ── Import Preview Dialog ─────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t.roster.importExport.previewTitle}</DialogTitle>
            <DialogDescription>
              {t.roster.importExport.detectedCount.replace('{count}', String(previewRows.length))} —{' '}
              <span className="text-green-600 font-medium">{t.roster.importExport.newCount.replace('{count}', String(previewNewCount))}</span>,{' '}
              <span className="text-blue-600 font-medium">{t.roster.importExport.updateCount.replace('{count}', String(previewChangeCount))}</span>,{' '}
              <span className="text-gray-500">{t.roster.importExport.unchangedCount.replace('{count}', String(previewUnchangedCount))}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 px-2">
            {previewRows.map((row) => (
              <div
                key={`${row.champion_name}_${row.newRarity}`}
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
                  <p className={`text-xs ${getClassColors(row.champion_class ?? 'Unknown').text}`}>
                    {row.champion_class ?? 'Unknown'}
                  </p>
                </div>

                {/* Status badge + diff */}
                <div className="shrink-0 text-right text-xs whitespace-nowrap">
                  {row.isNew ? (
                    <div>
                      <span className="inline-flex items-center gap-1 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mb-0.5">
                        {t.roster.importExport.badgeNew}
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
                    <span className="text-gray-400 italic">{t.roster.importExport.badgeUnchanged}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={importing}>
              {t.roster.importExport.cancel}
            </Button>
            <Button onClick={executeImport} disabled={importing || (previewChangeCount + previewNewCount === 0)}>
              {importing ? t.roster.importExport.importing : t.roster.importExport.importButton.replace('{count}', String(previewNewCount + previewChangeCount))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import Report Dialog ──────────────────────── */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t.roster.importExport.reportTitle}</DialogTitle>
            <DialogDescription className="flex items-center gap-3 mt-1">
              {reportSuccessCount > 0 && (
                <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                  <FiCheck size={14} /> {t.roster.importExport.successCount.replace('{count}', String(reportSuccessCount))}
                </span>
              )}
              {reportFailCount > 0 && (
                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                  <FiX size={14} /> {t.roster.importExport.failCount.replace('{count}', String(reportFailCount))}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700 px-2">
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
                        {t.roster.importExport.badgeAdded}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                        {t.roster.importExport.badgeUpdated}
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <FiAlertTriangle size={9} /> {t.roster.importExport.badgeError}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button onClick={() => setReportOpen(false)}>{t.roster.importExport.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
