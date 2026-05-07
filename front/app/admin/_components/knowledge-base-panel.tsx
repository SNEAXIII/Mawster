'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { Button } from '@/components/ui/button';
import {
  getSnapshotStats,
  forceSnapshotWars,
  type AllianceSnapshotStat,
} from '@/app/services/fight-records';

export default function KnowledgeBasePanel() {
  const { t } = useI18n();
  const [stats, setStats] = useState<AllianceSnapshotStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      setStats(await getSnapshotStats());
    } catch {
      setError(t.admin.knowledgeBase.loadError);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    setRefreshResult(null);
    setError(null);
    try {
      const result = await forceSnapshotWars();
      const msg = t.admin.knowledgeBase.refreshResult
        .replace('{{count}}', String(result.snapshotted))
        .replace('{{skipped}}', String(result.skipped));
      setRefreshResult(msg);
      await load();
    } catch {
      setError(t.admin.knowledgeBase.refreshError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className='mt-6 space-y-4'
      data-cy='knowledge-base-panel'
    >
      <div className='flex items-center gap-4'>
        <Button
          onClick={handleRefresh}
          disabled={loading}
          data-cy='refresh-wars-btn'
        >
          {loading ? t.admin.knowledgeBase.refreshing : t.admin.knowledgeBase.refreshButton}
        </Button>
        {refreshResult && <p className='text-sm text-muted-foreground'>{refreshResult}</p>}
      </div>

      {error && <p className='text-destructive text-sm'>{error}</p>}

      {stats.length === 0 ? (
        <p className='text-muted-foreground text-sm'>{t.admin.knowledgeBase.noData}</p>
      ) : (
        <table
          className='w-full text-sm border rounded-md'
          data-cy='snapshot-stats-table'
        >
          <thead>
            <tr className='border-b bg-muted/50'>
              <th className='text-left px-4 py-2 font-medium'>{t.admin.knowledgeBase.allianceColumn}</th>
              <th className='text-left px-4 py-2 font-medium'>{t.admin.knowledgeBase.warsColumn}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr
                key={s.alliance_id}
                className='border-b last:border-0'
              >
                <td className='px-4 py-2'>{s.alliance_name}</td>
                <td className='px-4 py-2'>{s.war_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
