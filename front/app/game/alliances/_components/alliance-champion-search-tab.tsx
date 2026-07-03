'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/app/i18n';
import { FullPageSpinner } from '@/components/full-page-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AllianceSelect from '@/app/game/_components/alliance-select';
import type { AllianceWithVisitorFlag } from '@/hooks/use-alliance-selector';
import RosterFilterBar from '@/components/roster/roster-filter-bar';
import {
  EMPTY_FILTERS,
  RosterFilters,
  applyRosterFilters,
  isFilterActive,
} from '@/components/roster/roster-filters';
import UpgradeRequestDialogs from '@/components/upgrade-request-dialogs';
import { useUpgradeRequests } from '@/hooks/use-upgrade-requests';
import {
  getAllianceRoster,
  getMyAllianceRoles,
  type AllianceRosterEntry,
} from '@/app/services/game';
import AllianceChampionGroup from './alliance-champion-group';

interface Props {
  alliances: AllianceWithVisitorFlag[];
  selectedAllianceId: string;
  onAllianceChange: (id: string) => void;
}

export default function AllianceChampionSearchTab({
  alliances,
  selectedAllianceId,
  onAllianceChange,
}: Readonly<Props>) {
  const { t } = useI18n();
  const cs = t.game.alliances.championSearch;
  const [roster, setRoster] = useState<AllianceRosterEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [canRequestUpgrade, setCanRequestUpgrade] = useState(false);
  const [filters, setFilters] = useState<RosterFilters>(EMPTY_FILTERS);
  const [group, setGroup] = useState('all');
  const upgrade = useUpgradeRequests();

  useEffect(() => {
    if (!selectedAllianceId) return;
    setGroup('all');
    setLoading(true);
    Promise.all([getAllianceRoster(selectedAllianceId), getMyAllianceRoles()])
      .then(([entries, roles]) => {
        setRoster(entries);
        const role = roles.roles[selectedAllianceId];
        setCanRequestUpgrade(!!role && (role.is_officer || role.is_owner));
      })
      .catch(() => setRoster([]))
      .finally(() => setLoading(false));
  }, [selectedAllianceId]);

  const scopedByGroup = useMemo(() => {
    if (group === 'all') return roster;
    return roster.filter((e) => String(e.alliance_group ?? 'none') === group);
  }, [roster, group]);

  const filtered = useMemo(
    () => applyRosterFilters(scopedByGroup, filters) as AllianceRosterEntry[],
    [scopedByGroup, filters]
  );

  const availableClasses = useMemo(
    () => Array.from(new Set(roster.map((e) => e.champion_class))).sort(),
    [roster]
  );

  const availableGroups = useMemo(() => {
    const set = new Set<number | null>();
    for (const e of roster) set.add(e.alliance_group ?? null);
    return Array.from(set).sort((a, b) => (a ?? 99) - (b ?? 99));
  }, [roster]);

  const groups = useMemo(() => {
    const byChampion = new Map<string, AllianceRosterEntry[]>();
    for (const e of filtered) {
      const list = byChampion.get(e.champion_id) ?? [];
      list.push(e);
      byChampion.set(e.champion_id, list);
    }
    return Array.from(byChampion.values())
      .map((entries) => ({
        championId: entries[0].champion_id,
        championName: entries[0].champion_name,
        championClass: entries[0].champion_class,
        imageUrl: entries[0].image_url,
        entries,
      }))
      .sort((a, b) => a.championName.localeCompare(b.championName));
  }, [filtered]);

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        {alliances.length > 1 && (
          <AllianceSelect
            alliances={alliances}
            value={selectedAllianceId}
            onChange={onAllianceChange}
            triggerClassName='w-full max-w-xs'
            dataCy='champion-search-alliance-select'
            placeholder={cs.selectAlliance}
          />
        )}

        {availableGroups.length > 1 && (
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className='h-8 w-40 text-xs' data-cy='champion-search-group-select'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{cs.allGroups}</SelectItem>
              {availableGroups.map((g) => (
                <SelectItem key={g ?? 'none'} value={String(g ?? 'none')}>
                  {g === null ? cs.noGroup : cs.groupOption.replace('{n}', String(g))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <RosterFilterBar
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters(EMPTY_FILTERS)}
        availableClasses={availableClasses}
        filteredCount={filtered.length}
        totalCount={roster.length}
      />

      {loading ? (
        <FullPageSpinner />
      ) : groups.length === 0 ? (
        <p className='text-muted-foreground py-8 text-center' data-cy='champion-search-empty'>
          {isFilterActive(filters) ? cs.noResults : cs.empty}
        </p>
      ) : (
        <div className='columns-3xs gap-3' data-cy='champion-search-results'>
          {groups.map((g) => (
            <div key={g.championId} className='mb-3 break-inside-avoid'>
              <AllianceChampionGroup
                championName={g.championName}
                championClass={g.championClass}
                imageUrl={g.imageUrl}
                entries={g.entries}
                canRequestUpgrade={canRequestUpgrade}
                onRequestUpgrade={upgrade.initiateUpgrade}
              />
            </div>
          ))}
        </div>
      )}

      <UpgradeRequestDialogs upgrade={upgrade} />
    </div>
  );
}
