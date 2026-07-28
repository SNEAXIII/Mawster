// Fully mocked data for the public landing "stats showcase".
// No API, no auth — these are illustrative sample numbers only.
import type { PlayerSeasonStats, ChampionUsageItem } from '@/app/services/statistics'
import type { RankingHistoryPoint } from '@/app/services/game'

// Player season table (mirrors the in-app alliance statistics table).
// Only raw values per player — ratio and per-war averages are computed in `row()`.
export const MOCK_SEASON_STATS: PlayerSeasonStats[] = [
  row('m1', 'CosmicGhost', 1, {
    kos: 0,
    fights: 40,
    weighted: 40,
    assists: 0,
    miniboss: 18,
    boss: 2,
    wars: 5,
    notFought: 0,
  }),
  row('m2', 'ThunderFist', 1, {
    kos: 0,
    fights: 26,
    weighted: 27,
    assists: 2,
    miniboss: 8,
    boss: 1,
    wars: 5,
    notFought: 0,
  }),
  row('m3', 'StormBreaker', 3, {
    kos: 1,
    fights: 50,
    weighted: 46,
    assists: 1,
    miniboss: 16,
    boss: 2,
    wars: 7,
    notFought: 0,
  }),
  row('m4', 'SteelNerve', 2, {
    kos: 1,
    fights: 50,
    weighted: 49,
    assists: 1,
    miniboss: 20,
    boss: 1,
    wars: 7,
    notFought: 1,
  }),
  row('m5', 'CrimsonWolf', 2, {
    kos: 1,
    fights: 34,
    weighted: 32,
    assists: 0,
    miniboss: 4,
    boss: 2,
    wars: 7,
    notFought: 0,
  }),
  row('m6', 'ShadowReaper', 1, {
    kos: 2,
    fights: 50,
    weighted: 43,
    assists: 2,
    miniboss: 14,
    boss: 2,
    wars: 7,
    notFought: 0,
  }),
  row('m7', 'VenomPulse', 1, {
    kos: 2,
    fights: 41,
    weighted: 41,
    assists: 3,
    miniboss: 12,
    boss: 1,
    wars: 7,
    notFought: 0,
  }),
  row('m8', 'IronVortex', 3, {
    kos: 2,
    fights: 40,
    weighted: 39,
    assists: 1,
    miniboss: 10,
    boss: 1,
    wars: 7,
    notFought: 0,
  }),
  row('m9', 'NightCrawler99', 3, {
    kos: 2,
    fights: 38,
    weighted: 36,
    assists: 0,
    miniboss: 6,
    boss: 0,
    wars: 6,
    notFought: 1,
  }),
  row('m10', 'BlazeRunner', 2, {
    kos: 3,
    fights: 50,
    weighted: 45,
    assists: 4,
    miniboss: 9,
    boss: 1,
    wars: 7,
    notFought: 1,
  }),
  row('m11', 'FrostByte', 1, {
    kos: 3,
    fights: 45,
    weighted: 42,
    assists: 0,
    miniboss: 7,
    boss: 0,
    wars: 7,
    notFought: 0,
  }),
  row('m12', 'NovaPrime', 3, {
    kos: 3,
    fights: 42,
    weighted: 39,
    assists: 2,
    miniboss: 5,
    boss: 1,
    wars: 6,
    notFought: 1,
  }),
  row('m13', 'RogueSignal', 1, {
    kos: 3,
    fights: 36,
    weighted: 33,
    assists: 0,
    miniboss: 6,
    boss: 1,
    wars: 6,
    notFought: 1,
  }),
  row('m14', 'TitanForce', 2, {
    kos: 4,
    fights: 42,
    weighted: 35,
    assists: 1,
    miniboss: 3,
    boss: 0,
    wars: 6,
    notFought: 2,
  }),
  row('m15', 'GhostProtocol', 2, {
    kos: 5,
    fights: 48,
    weighted: 40,
    assists: 1,
    miniboss: 4,
    boss: 0,
    wars: 7,
    notFought: 2,
  }),
  row('m16', 'ApexHunter', 3, {
    kos: 6,
    fights: 48,
    weighted: 40,
    assists: 1,
    miniboss: 3,
    boss: 0,
    wars: 6,
    notFought: 3,
  }),
  row('m17', 'EchoStrike', 2, {
    kos: 4,
    fights: 25,
    weighted: 22,
    assists: 0,
    miniboss: 4,
    boss: 0,
    wars: 5,
    notFought: 2,
  }),
  row('m18', 'LunarFang', 1, {
    kos: 7,
    fights: 30,
    weighted: 26,
    assists: 0,
    miniboss: 2,
    boss: 0,
    wars: 5,
    notFought: 4,
  }),
]

// Champion KO distribution (defender perspective) for the donut chart.
export const MOCK_CHAMPION_USAGE: ChampionUsageItem[] = [
  champ('Mojo', 80),
  champ('Baron Zemo', 68),
  champ('Onslaught', 59),
  champ('Absorbing Man', 41),
  champ('Prowler', 34),
  champ('Kushala', 32),
  champ('Wave', 42),
]

// Season ranking progression (ELO per war). First war lost, then a win streak.
export const MOCK_RANKING_POINTS: RankingHistoryPoint[] = [
  pt(1, 'House of Ideas', 3900, true),
  pt(2, 'Quantum Realm', 3925, true),
  pt(3, 'Battleworld', 3950, false),
  pt(4, 'Knull Knights', 3920, false),
  pt(5, 'Sinister Six', 3900, true),
  pt(6, 'Cosmic Crusaders', 3925, true),
  pt(7, 'Eternals Elite', 3950, true),
  pt(8, 'Phoenix Force', 3975, true),
]

export const MOCK_RANKING_SEASON = 67

interface RowInput {
  kos: number
  fights: number // raw attack fights — drives ratio and avg_fights_per_war
  weighted: number // total_fights_weighted, shown in the "Fights" column
  assists: number
  miniboss: number
  boss: number
  wars: number
  notFought: number
}

// Derived fields mirror the backend (StatisticService): ratio, avg_fights_per_war
// and avg_boss_miniboss_per_war are computed here so the table can never drift.
function row(
  id: string,
  pseudo: string,
  group: number,
  v: RowInput,
  isCurrent = true
): PlayerSeasonStats {
  const ratio = v.fights > 0 ? Math.floor((1 - v.kos / v.fights) * 100) : 100
  return {
    id,
    game_pseudo: pseudo,
    alliance_group: group,
    total_kos: v.kos,
    total_fights: v.fights,
    total_fights_weighted: v.weighted,
    total_assists: v.assists,
    total_times_helped: 0,
    total_miniboss: v.miniboss,
    total_boss: v.boss,
    total_not_fought: v.notFought,
    ratio,
    score: 0,
    wars_participated: v.wars,
    avg_fights_per_war: v.fights / v.wars,
    avg_boss_miniboss_per_war: (v.miniboss + v.boss) / v.wars,
    is_current_member: isCurrent,
  }
}

function champ(name: string, kos: number): ChampionUsageItem {
  const slug = name.toLowerCase().replace(/\s+/g, '_')
  return {
    champion_id: slug,
    champion_name: name,
    fight_count: kos,
    total_kos: kos,
    image_url: `/static/champions/${slug}.png`,
  }
}

function pt(war: number, opponent: string, elo: number, win: boolean): RankingHistoryPoint {
  return { war_number: war, opponent_name: opponent, tier: 1, elo_after: elo, win }
}
