'use client';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ChampionFilterSelect from '@/app/game/knowledge-base/_components/champion-filter-select';
import { getChampions, type Champion } from '@/app/services/champions';
import {
  getAccessibleAlliances,
  importFightRecords,
  type ImportRow,
  type AccessibleAlliance,
} from '@/app/services/fight-records';
import { getMyAllianceRoles } from '@/app/services/game';

interface RawRow {
  attackerName: string;
  defenderName: string;
  node: number;
  seasonName: string;
  koCount: number;
}

function parseCSV(text: string): RawRow[] {
  const lines = text.trim().split('\n').slice(1);
  return lines
    .filter(line => line.trim())
    .map((line, i) => {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 5) throw new Error(`Row ${i + 2}: expected 5 columns`);
      const node = parseInt(parts[2], 10);
      const koCount = parseInt(parts[4], 10);
      if (isNaN(node) || node < 1 || node > 50)
        throw new Error(`Row ${i + 2}: invalid node (1-50)`);
      if (isNaN(koCount) || koCount < 0)
        throw new Error(`Row ${i + 2}: invalid ko_count`);
      return {
        attackerName: parts[0],
        defenderName: parts[1],
        node,
        seasonName: parts[3],
        koCount,
      };
    });
}

export default function CsvImportForm() {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;
  const fileRef = useRef<HTMLInputElement>(null);

  const [champions, setChampions] = useState<Champion[]>([]);
  const [alliances, setAlliances] = useState<AccessibleAlliance[]>([]);
  const [selectedAllianceId, setSelectedAllianceId] = useState<string | null>(null);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [resourcesLoaded, setResourcesLoaded] = useState(false);

  const loadResources = async (): Promise<Champion[]> => {
    const [champsData, accessibleAlliances, rolesData] = await Promise.all([
      getChampions(1, 9999),
      getAccessibleAlliances(),
      getMyAllianceRoles(),
    ]);
    const champs = champsData.champions;
    setChampions(champs);
    const managedAlliances = accessibleAlliances.filter(
      a => rolesData.roles[a.id]?.is_owner || rolesData.roles[a.id]?.is_officer
    );
    setAlliances(managedAlliances);
    if (managedAlliances.length === 1) {
      setSelectedAllianceId(managedAlliances[0].id);
    }
    setResourcesLoaded(true);
    return champs;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let champs = champions;
    if (!resourcesLoaded) {
      try {
        champs = await loadResources();
      } catch {
        toast.error(kb.importError);
        return;
      }
    }

    const text = await file.text();
    try {
      const parsed = parseCSV(text);
      setRows(parsed);

      const unknownMap: Record<string, null> = {};
      const seen = new Set<string>();
      for (const r of parsed) {
        for (const name of [r.attackerName, r.defenderName]) {
          const lower = name.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            const match = champs.find(c => c.name.toLowerCase() === lower);
            if (!match) unknownMap[name] = null;
          }
        }
      }
      setNameMap(unknownMap);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : kb.importError;
      toast.error(message);
    }
  };

  const resolveId = (name: string, champs: Champion[]): string | null => {
    const lower = name.toLowerCase();
    const direct = champs.find(c => c.name.toLowerCase() === lower);
    if (direct) return direct.id;
    return nameMap[name] ?? null;
  };

  const allResolved =
    rows.length > 0 &&
    rows.every(r => resolveId(r.attackerName, champions) && resolveId(r.defenderName, champions));

  const handleImport = async () => {
    if (!selectedAllianceId) return;
    const payload: ImportRow[] = rows.map(r => ({
      champion_id: resolveId(r.attackerName, champions)!,
      defender_champion_id: resolveId(r.defenderName, champions)!,
      node_number: r.node,
      season_name: r.seasonName,
      ko_count: r.koCount,
    }));
    setLoading(true);
    try {
      const res = await importFightRecords(selectedAllianceId, { rows: payload });
      toast.success(kb.importSuccess.replace('{count}', String(res.imported)));
      if (res.skipped > 0)
        toast.info(kb.importSkipped.replace('{count}', String(res.skipped)));
      setRows([]);
      setNameMap({});
      if (fileRef.current) fileRef.current.value = '';
    } catch {
      toast.error(kb.importError);
    } finally {
      setLoading(false);
    }
  };

  const unknownNames = Object.keys(nameMap);

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <p className='text-sm text-muted-foreground'>{kb.importUploadHint}</p>
        <Input
          ref={fileRef}
          type='file'
          accept='.csv'
          onChange={handleFile}
          data-cy='csv-file-input'
        />
      </div>

      {alliances.length > 1 && (
        <Select
          value={selectedAllianceId ?? ''}
          onValueChange={setSelectedAllianceId}
        >
          <SelectTrigger className='w-64' data-cy='import-alliance-trigger'>
            <SelectValue placeholder={kb.importAllianceLabel} />
          </SelectTrigger>
          <SelectContent>
            {alliances.map(a => (
              <SelectItem key={a.id} value={a.id}>
                [{a.tag}] {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {unknownNames.length > 0 && (
        <div className='space-y-2'>
          <p className='font-medium text-sm' data-cy='import-resolve-title'>{kb.importResolveTitle}</p>
          {unknownNames.map(name => (
            <div key={name} className='flex items-center gap-3'>
              <span className='text-sm text-muted-foreground w-36 truncate'>
                {kb.importUnknown.replace('{name}', name)}
              </span>
              <ChampionFilterSelect
                value={nameMap[name]}
                onChange={id => setNameMap(m => ({ ...m, [name]: id }))}
                placeholder={kb.selectChampion}
                data-cy={`champion-map-${name}`}
              />
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className='space-y-3'>
          <p className='font-medium text-sm'>
            {kb.importPreviewTitle.replace('{count}', String(rows.length))}
          </p>
          <div className='overflow-x-auto rounded-lg border'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='bg-muted/50 text-muted-foreground'>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColAttacker}</th>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColDefender}</th>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColNode}</th>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColSeason}</th>
                  <th className='px-3 py-2 text-left font-medium'>{kb.importColKo}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const attackerOk = !!resolveId(row.attackerName, champions);
                  const defenderOk = !!resolveId(row.defenderName, champions);
                  return (
                    <tr key={i} className='border-t'>
                      <td className={`px-3 py-1.5 ${!attackerOk ? 'text-destructive font-medium' : ''}`}>
                        {row.attackerName}
                      </td>
                      <td className={`px-3 py-1.5 ${!defenderOk ? 'text-destructive font-medium' : ''}`}>
                        {row.defenderName}
                      </td>
                      <td className='px-3 py-1.5 text-muted-foreground'>{row.node}</td>
                      <td className='px-3 py-1.5 text-muted-foreground'>{row.seasonName}</td>
                      <td className='px-3 py-1.5 text-muted-foreground'>{row.koCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button
            onClick={handleImport}
            disabled={loading || !allResolved || !selectedAllianceId}
            data-cy='import-confirm-btn'
          >
            {kb.importConfirmBtn.replace('{count}', String(rows.length))}
          </Button>
        </div>
      )}
    </div>
  );
}
