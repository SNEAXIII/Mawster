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
import { EMPTY_FILTERS, RosterFilters, isFilterActive } from '@/components/roster/roster-filters';
import UpgradeRequestDialogs from '@/components/upgrade-request-dialogs';
import { useUpgradeRequests } from '@/hooks/use-upgrade-requests';
import { ChampionClass } from '@/app/services/champions';
import {
  getAllianceRoster,
  getMyAllianceRoles,
  type AllianceRosterEntry,
  type AllianceRosterQuery,
} from '@/app/services/game';
import AllianceChampionGroup from './alliance-champion-group';

/** Max distinct champions the API returns for this tab. */
const DISTINCT_CHAMPION_LIMIT = 20;
/** Debounce for the free-text name filter before hitting the API. */
const NAME_DEBOUNCE_MS = 300;

const AVAILABLE_CLASSES = Object.values(ChampionClass);
const GROUP_OPTIONS = ['1', '2', '3'] as const;

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
  const [debouncedName, setDebouncedName] = useState('');
  const [lastAllianceId, setLastAllianceId] = useState(selectedAllianceId);
  const upgrade = useUpgradeRequests();

  // Reset the group filter when the alliance changes. Done during render rather than
  // in an effect so `query` is rebuilt before the fetch effect runs — an effect would
  // fire one fetch with the previous group and another with 'all'.
  if (lastAllianceId !== selectedAllianceId) {
    setLastAllianceId(selectedAllianceId);
    setGroup('all');
  }

  // Resolve upgrade rights once per alliance (independent of filters).
  useEffect(() => {
    if (!selectedAllianceId) return;
    getMyAllianceRoles()
      .then((roles) => {
        const role = roles.roles[selectedAllianceId];
        setCanRequestUpgrade(!!role && (role.is_officer || role.is_owner));
      })
      .catch(() => setCanRequestUpgrade(false));
  }, [selectedAllianceId]);

  // Debounce the free-text name filter so typing doesn't hammer the API.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedName(filters.name), NAME_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [filters.name]);

  // Server-side query: all filtering + the distinct-champion cap happen in the API.
  const query = useMemo<AllianceRosterQuery>(
    () => ({
      name: debouncedName,
      championClass: filters.championClass || undefined,
      ranks: filters.ranks.length ? filters.ranks : undefined,
      ascensions: filters.ascensions.length ? filters.ascensions : undefined,
      sagaAttacker: filters.sagaAttacker || undefined,
      sagaDefender: filters.sagaDefender || undefined,
      preferredAttacker: filters.preferredAttacker || undefined,
      allianceGroup: /^\d+$/.test(group) ? Number(group) : undefined,
      noGroup: group === 'none' || undefined,
      distinctChampionLimit: DISTINCT_CHAMPION_LIMIT,
    }),
    [
      debouncedName,
      filters.championClass,
      filters.ranks,
      filters.ascensions,
      filters.sagaAttacker,
      filters.sagaDefender,
      filters.preferredAttacker,
      group,
    ]
  );

  useEffect(() => {
    if (!selectedAllianceId) {
      setRoster([]);
      return;
    }
    // Filters change faster than the API answers: ignore a response that is no longer
    // the current query, otherwise a slow earlier request overwrites a fresher one.
    let stale = false;
    setLoading(true);
    getAllianceRoster(selectedAllianceId, query)
      .then((entries) => {
        if (!stale) setRoster(entries);
      })
      .catch(() => {
        if (!stale) setRoster([]);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [selectedAllianceId, query]);

  // Group the returned entries by champion for display (API already filtered + capped).
  const groups = useMemo(() => {
    const byChampion = new Map<string, AllianceRosterEntry[]>();
    for (const e of roster) {
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
  }, [roster]);

  const groupSelect = (
    <Select value={group} onValueChange={setGroup}>
      <SelectTrigger className='h-8 w-40 text-xs' data-cy='champion-search-group-select'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value='all'>{cs.allGroups}</SelectItem>
        {GROUP_OPTIONS.map((g) => (
          <SelectItem key={g} value={g}>
            {cs.groupOption.replace('{n}', g)}
          </SelectItem>
        ))}
        <SelectItem value='none'>{cs.noGroup}</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className='flex flex-col gap-4'>
      {alliances.length > 1 && (
        <div className='flex flex-wrap items-center gap-2'>
          <AllianceSelect
            alliances={alliances}
            value={selectedAllianceId}
            onChange={onAllianceChange}
            dataCy='champion-search-alliance-select'
            placeholder={cs.selectAlliance}
          />
        </div>
      )}

      <RosterFilterBar
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters(EMPTY_FILTERS)}
        availableClasses={AVAILABLE_CLASSES}
        leading={groupSelect}
        showAwakened={false}
        showMinSig={false}
        showCount={false}
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
