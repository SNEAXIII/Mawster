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
  type Alliance,
  type AllianceRosterEntry,
} from '@/app/services/game';
import AllianceChampionGroup from './alliance-champion-group';

interface Props {
  alliances: Alliance[];
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
  const upgrade = useUpgradeRequests();

  useEffect(() => {
    if (!selectedAllianceId) return;
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

  const filtered = useMemo(
    () => applyRosterFilters(roster, filters) as AllianceRosterEntry[],
    [roster, filters]
  );

  const availableClasses = useMemo(
    () => Array.from(new Set(roster.map((e) => e.champion_class))).sort(),
    [roster]
  );

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
      {alliances.length > 1 && (
        <Select value={selectedAllianceId} onValueChange={onAllianceChange}>
          <SelectTrigger className='w-full max-w-xs' data-cy='champion-search-alliance-select'>
            <SelectValue placeholder={cs.selectAlliance} />
          </SelectTrigger>
          <SelectContent>
            {alliances.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name} [{a.tag}]</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
        <div className='grid gap-3 sm:grid-cols-2'>
          {groups.map((g) => (
            <AllianceChampionGroup
              key={g.championId}
              championName={g.championName}
              championClass={g.championClass}
              imageUrl={g.imageUrl}
              entries={g.entries}
              canRequestUpgrade={canRequestUpgrade}
              onRequestUpgrade={upgrade.initiateUpgrade}
            />
          ))}
        </div>
      )}

      <UpgradeRequestDialogs upgrade={upgrade} />
    </div>
  );
}
