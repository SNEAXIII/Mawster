'use client'

import { useI18n } from '@/app/i18n'
import { Button } from '@/components/ui/button'
import { useSnapshotStatsViewModel } from '../_viewmodels/use-snapshot-stats-viewmodel'

export default function KnowledgeBasePanel() {
  const { t } = useI18n()
  const { stats, loading, refreshResult, error, handleRefresh } = useSnapshotStatsViewModel()

  return (
    <div
      className='mt-6 flex flex-col gap-4'
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
              <th className='text-left px-4 py-2 font-medium'>
                {t.admin.knowledgeBase.allianceColumn}
              </th>
              <th className='text-left px-4 py-2 font-medium'>
                {t.admin.knowledgeBase.warsColumn}
              </th>
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
  )
}
