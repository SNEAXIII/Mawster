'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, Users } from 'lucide-react';
import { FiFlag } from 'react-icons/fi';
import { useI18n } from '@/app/i18n';
import { getChampionImageUrl } from '@/app/services/champions';
import { shortenChampionName } from '@/app/services/roster';
import type { FightRecord, SynergyRecord, PrefightRecord } from '@/app/services/fight-records';
import { reportNote } from '@/app/services/moderation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/app/lib/utils';

type NoteCellProps = Readonly<{ record: FightRecord }>;

function NoteCell({ record }: NoteCellProps) {
  const { t } = useI18n();
  const [reported, setReported] = useState(false);
  const hasNote = !record.note_blocked && !!record.note;

  const onReport = async () => {
    if (!record.note_id) return;
    try {
      await reportNote(record.note_id);
      setReported(true);
      toast.success(t.moderation.reportSuccess);
    } catch (err) {
      toast.error((err as Error).message || t.moderation.reportError);
    }
  };

  return (
    <td className='px-3 py-2 max-w-48'>
      <div className='flex flex-col gap-0.5'>
        <div className='flex items-start gap-1'>
          {record.note_blocked ? (
            <span className='italic text-muted-foreground truncate' data-cy='kb-note-blocked'>
              {t.moderation.noteBlocked}
            </span>
          ) : hasNote ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type='button'
                  className='truncate text-left cursor-pointer hover:text-foreground transition-colors'
                  data-cy='kb-note-text'
                  title={t.game.knowledgeBase.noteExpand}
                >
                  {record.note}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className='max-h-80 w-80 overflow-y-auto whitespace-pre-wrap break-words text-sm'
                data-cy='kb-note-popover'
              >
                {record.note}
                {record.note_author && (
                  <p className='mt-2 text-[10px] text-muted-foreground'>
                    {t.game.knowledgeBase.noteBy} {record.note_author}
                  </p>
                )}
              </PopoverContent>
            </Popover>
          ) : (
            <span className='text-muted-foreground'>—</span>
          )}
          {record.note_id && !record.note_blocked && (
            <button
              className='shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
              data-cy='kb-note-report'
              disabled={reported}
              title={reported ? t.moderation.reported : t.moderation.report}
              onClick={onReport}
            >
              <FiFlag className='h-3.5 w-3.5' />
            </button>
          )}
        </div>
        {record.note_author && !record.note_blocked && (
          <span className='text-[10px] text-muted-foreground truncate' data-cy='kb-note-author'>
            {t.game.knowledgeBase.noteBy} {record.note_author}
          </span>
        )}
      </div>
    </td>
  );
}

interface Props {
  readonly records: ReadonlyArray<FightRecord>;
  readonly loading: boolean;
  readonly sortBy: string;
  readonly sortOrder: 'asc' | 'desc';
  readonly onSort: (col: string) => void;
}

type SortIconProps = Readonly<{
  col: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}>;

function SortIcon({ col, sortBy, sortOrder }: SortIconProps) {
  if (sortBy !== col) return <ArrowUpDown className='ml-1 h-3 w-3 inline opacity-40' />;
  return sortOrder === 'asc'
    ? <ArrowUp className='ml-1 h-3 w-3 inline' />
    : <ArrowDown className='ml-1 h-3 w-3 inline' />;
}

type SortableThProps = Readonly<{
  col: string;
  label: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (c: string) => void;
}>;

function SortableTh({ col, label, sortBy, sortOrder, onSort }: SortableThProps) {
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

type ChampionCellProps = Readonly<{
  name: string;
  imageUrl: string | null;
  stars?: number | null;
  rank?: number | null;
}>;

function ChampionCell({ name, imageUrl, stars, rank }: ChampionCellProps) {
  const src = getChampionImageUrl(imageUrl, 40);
  return (
    <td className='px-3 py-2'>
      <div className='flex items-center gap-2'>
        {src && <img src={src} alt={name} className='w-10 h-10 object-contain rounded' />}
        <div>
          <p className='text-sm font-medium whitespace-nowrap'>{shortenChampionName(name)}</p>
          <p className='text-xs text-muted-foreground'>{stars != null ? `${stars}★` : ''}{rank != null ? ` R${rank}` : ''}</p>
        </div>
      </div>
    </td>
  );
}

type SynergiesCellProps = Readonly<{
  synergies: ReadonlyArray<SynergyRecord>;
}>;

function SynergiesCell({ synergies }: SynergiesCellProps) {
  return (
    <td className='px-3 py-2'>
      <div className='flex items-center gap-1 flex-wrap'>
        {synergies.map((s) => {
          const src = getChampionImageUrl(s.image_url, 40);
          return src ? (
            <img key={s.champion_id} src={src} alt={s.champion_name} title={s.champion_name} className='object-contain rounded' />
          ) : (
            <span key={s.champion_id} className='text-xs text-muted-foreground'>{s.champion_name}</span>
          );
        })}
      </div>
    </td>
  );
}

type PrefightsCellProps = Readonly<{
  prefights: ReadonlyArray<PrefightRecord>;
}>;

function PrefightsCell({ prefights }: PrefightsCellProps) {
  return (
    <td className='px-3 py-2'>
      <div className='flex items-center gap-1 flex-wrap'>
        {prefights.map((p) => {
          const src = getChampionImageUrl(p.image_url, 40);
          return src ? (
            <img key={p.champion_id} src={src} alt={p.champion_name} title={p.champion_name} className='object-contain rounded' />
          ) : (
            <span key={p.champion_id} className='text-xs text-muted-foreground'>{p.champion_name}</span>
          );
        })}
      </div>
    </td>
  );
}

export default function KnowledgeBaseTable({ records, loading, sortBy, sortOrder, onSort }: Props) {
  const { t } = useI18n();
  const kb = t.game.knowledgeBase;

  const cols = [
    { col: null, label: kb.player },
    { col: 'champion_name', label: kb.attacker },
    { col: 'defender_champion_name', label: kb.defender },
    { col: null, label: kb.synergies },
    { col: null, label: kb.prefights },
    { col: 'node_number', label: kb.node },
    { col: 'tier', label: kb.tier },
    { col: 'ko_count', label: kb.ko },
    { col: 'alliance_name', label: kb.alliance },
    { col: 'created_at', label: kb.date },
    { col: null, label: kb.note },
  ];

  return (
    <div className={cn('overflow-x-auto rounded-md border border-border', loading && 'opacity-50')}>
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
          {!loading && records.length === 0 && (
            <tr>
              <td colSpan={11} className='px-3 py-8 text-center text-muted-foreground'>{kb.noData}</td>
            </tr>
          )}
          {!loading && records.map((r) => (
            <tr key={r.id} className='border-t border-border hover:bg-muted/30 transition-colors'>
              <td className='px-3 py-2 whitespace-nowrap'>
                <div className='flex items-center gap-1'>
                  {r.game_account_pseudo}
                  {r.is_planning_error && (
                    <span title={kb.planningErrorBadge} data-cy='fight-record-planning-error'>
                      <AlertTriangle className='h-3.5 w-3.5 text-amber-500 shrink-0' />
                    </span>
                  )}
                  {r.assisted && (
                    <span title={kb.assistedBadge}>
                      <Users className='h-3.5 w-3.5 text-blue-400 shrink-0' />
                    </span>
                  )}
                </div>
              </td>
              <ChampionCell name={r.champion_name} imageUrl={r.image_url} stars={r.stars} rank={r.rank} />
              <ChampionCell name={r.defender_champion_name} imageUrl={r.defender_image_url} stars={r.defender_stars} rank={r.defender_rank} />
              <SynergiesCell synergies={r.synergies} />
              <PrefightsCell prefights={r.prefights} />
              <td className='px-3 py-2'>{r.node_number}</td>
              <td className='px-3 py-2'>{r.tier}</td>
              <td className={cn('px-3 py-2',r.ko_count ? 'text-red-500' : 'text-green-500' )} data-cy='fight-record-ko'>{r.ko_count}</td>
              <td className='px-3 py-2'>{r.alliance_name}</td>
              <td className='px-3 py-2 whitespace-nowrap'>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
              <NoteCell record={r} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
