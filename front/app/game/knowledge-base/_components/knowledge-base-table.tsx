'use client';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useI18n } from '@/app/i18n';
import { getChampionImageUrl } from '@/app/services/champions';
import type { FightRecord, SynergyRecord } from '@/app/services/fight-records';

interface Props {
  records: FightRecord[];
  loading: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (col: string) => void;
}

function SortIcon({ col, sortBy, sortOrder }: { col: string; sortBy: string; sortOrder: 'asc' | 'desc' }) {
  if (sortBy !== col) return <ArrowUpDown className='ml-1 h-3 w-3 inline opacity-40' />;
  return sortOrder === 'asc'
    ? <ArrowUp className='ml-1 h-3 w-3 inline' />
    : <ArrowDown className='ml-1 h-3 w-3 inline' />;
}

function SortableTh({ col, label, sortBy, sortOrder, onSort }: { col: string; label: string; sortBy: string; sortOrder: 'asc' | 'desc'; onSort: (c: string) => void }) {
  return (
    <th
      className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground cursor-pointer whitespace-nowrap select-none hover:text-foreground'
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} sortBy={sortBy} sortOrder={sortOrder} />
    </th>
  );
}

function ChampionCell({ name, imageUrl, stars, rank }: { name: string; imageUrl: string | null; stars: number; rank: number }) {
  const src = getChampionImageUrl(imageUrl, 40);
  return (
    <td className='px-3 py-2'>
      <div className='flex items-center gap-2'>
        {src && <img src={src} alt={name} className='w-10 h-10 object-contain rounded' />}
        <div>
          <p className='text-sm font-medium whitespace-nowrap'>{name}</p>
          <p className='text-xs text-muted-foreground'>{stars}★ R{rank}</p>
        </div>
      </div>
    </td>
  );
}

function SynergiesCell({ synergies }: { synergies: SynergyRecord[] }) {
  const shown = synergies.slice(0, 4);
  const extra = synergies.length - shown.length;
  return (
    <td className='px-3 py-2'>
      <div className='flex items-center gap-1 flex-wrap'>
        {shown.map((s) => {
          const src = getChampionImageUrl(s.image_url, 28);
          return src ? (
            <img key={s.champion_id} src={src} alt={s.champion_name} title={s.champion_name} className='w-7 h-7 object-contain rounded' />
          ) : (
            <span key={s.champion_id} className='text-xs text-muted-foreground'>{s.champion_name}</span>
          );
        })}
        {extra > 0 && <span className='text-xs text-muted-foreground'>+{extra}</span>}
      </div>
    </td>
  );
}

export default function KnowledgeBaseTable({ records, loading, sortBy, sortOrder, onSort }: Props) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  const cols = [
    { col: 'champion_name', label: kb.attacker },
    { col: 'defender_champion_name', label: kb.defender },
    { col: null, label: kb.synergies },
    { col: 'node_number', label: kb.node },
    { col: 'battlegroup', label: kb.battlegroup },
    { col: 'tier', label: kb.tier },
    { col: 'ko_count', label: kb.ko },
    { col: 'alliance_name', label: kb.alliance },
    { col: 'created_at', label: kb.date },
  ];

  return (
    <div className='overflow-x-auto rounded-md border border-border'>
      <table className='w-full text-sm' data-cy='fight-records-table'>
        <thead className='bg-muted/50'>
          <tr>
            {cols.map(({ col, label }) =>
              col ? (
                <SortableTh key={col} col={col} label={label} sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              ) : (
                <th key={label} className='px-3 py-2 text-left text-xs font-semibold text-muted-foreground'>{label}</th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={9} className='px-3 py-8 text-center text-muted-foreground'>{t.common.loading}</td>
            </tr>
          )}
          {!loading && records.length === 0 && (
            <tr>
              <td colSpan={9} className='px-3 py-8 text-center text-muted-foreground'>{kb.noData}</td>
            </tr>
          )}
          {!loading && records.map((r) => (
            <tr key={r.id} className='border-t border-border hover:bg-muted/30 transition-colors'>
              <ChampionCell name={r.champion_name} imageUrl={r.image_url} stars={r.stars} rank={r.rank} />
              <ChampionCell name={r.defender_champion_name} imageUrl={r.defender_image_url} stars={r.defender_stars} rank={r.defender_rank} />
              <SynergiesCell synergies={r.synergies} />
              <td className='px-3 py-2'>{r.node_number}</td>
              <td className='px-3 py-2'>{r.battlegroup}</td>
              <td className='px-3 py-2'>{r.tier}</td>
              <td className='px-3 py-2'>{r.ko_count}</td>
              <td className='px-3 py-2'>{r.alliance_name}</td>
              <td className='px-3 py-2 whitespace-nowrap'>{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
