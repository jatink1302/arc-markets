import "server-only";
import { parse } from "csv-parse/sync";

// nflverse (https://github.com/nflverse/nflverse-data) — free, open-source, community-maintained
// NFL data, no relation to Sleeper. Verified directly before building on it: the unversioned
// `player_stats.csv` file is stale (hasn't updated since before the 2025 season); the correctly
// maintained release is `stats_player`, and specifically the `_week_` variant — `_reg_` turned
// out to be season-aggregate totals (a `games` column, no `week` column at all), not a weekly
// breakdown, caught by inspecting a real row rather than trusting the filename. Rosters/stats/
// photos all come from here now; Sleeper is only ever used to resolve *which* real players are
// on a league's rosters, never as the source of player content.
const RELEASES_BASE = "https://github.com/nflverse/nflverse-data/releases/download";

async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    throw new Error(`nflverse fetch failed: ${url} (${res.status})`);
  }
  const text = await res.text();
  return parse(text, { columns: true, skip_empty_lines: true });
}

// Sleeper's own `gsis_id` field has inconsistent leading/trailing whitespace on some rows
// (confirmed directly — e.g. some ids come back as " 00-0035228" instead of "00-0035228"),
// which silently breaks exact-match lookups if not trimmed. Also used to normalize names for
// the fallback match below, since Sleeper's gsis_id is only populated for ~20% of rostered
// players in practice — most players need to be matched by name instead.
export function normalizeGsisId(id: string): string {
  return id.trim();
}

export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[.'`]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type NflverseRosterEntry = {
  gsisId: string;
  fullName: string;
  team: string | null;
  position: string | null;
  status: string | null;
  headshotUrl: string | null;
};

export type NflverseRosterIndex = {
  byGsisId: Map<string, NflverseRosterEntry>;
  // A normalized name is not unique — real players share full names (e.g. two different
  // active NFL players are both named "Justin Jefferson"). Keeping every candidate lets
  // the caller disambiguate against other known facts (e.g. Sleeper's own team for that
  // player) instead of silently trusting whichever row happened to be inserted last.
  byNormalizedName: Map<string, NflverseRosterEntry[]>;
};

const rostersCache = new Map<string, Promise<NflverseRosterIndex>>();

export async function getNflverseRosters(season: string): Promise<NflverseRosterIndex> {
  const cached = rostersCache.get(season);
  if (cached) return cached;

  const promise = (async () => {
    const rows = await fetchCsv(`${RELEASES_BASE}/rosters/roster_${season}.csv`);
    const byGsisId = new Map<string, NflverseRosterEntry>();
    const byNormalizedName = new Map<string, NflverseRosterEntry[]>();
    for (const row of rows) {
      if (!row.gsis_id) continue;
      const entry: NflverseRosterEntry = {
        gsisId: normalizeGsisId(row.gsis_id),
        fullName: row.full_name || row.gsis_id,
        team: row.team || null,
        position: row.position || null,
        status: row.status || null,
        headshotUrl: row.headshot_url || null,
      };
      byGsisId.set(entry.gsisId, entry);
      if (row.full_name) {
        const key = normalizePlayerName(row.full_name);
        const existing = byNormalizedName.get(key);
        if (existing) existing.push(entry);
        else byNormalizedName.set(key, [entry]);
      }
    }
    return { byGsisId, byNormalizedName };
  })();

  rostersCache.set(season, promise);
  return promise;
}

export type NflverseWeeklyStat = { week: number; pointsPpr: number };

const weeklyStatsCache = new Map<string, Promise<Map<string, NflverseWeeklyStat[]>>>();

// `stats_player_week_{season}` — one row per player per week they actually played, regular
// season only (the file also contains playoff/"POST" rows, filtered out here), with
// `fantasy_points_ppr` already computed.
export async function getNflverseWeeklyStats(
  season: string,
): Promise<Map<string, NflverseWeeklyStat[]>> {
  const cached = weeklyStatsCache.get(season);
  if (cached) return cached;

  const promise = (async () => {
    const rows = await fetchCsv(`${RELEASES_BASE}/stats_player/stats_player_week_${season}.csv`);
    const byGsisId = new Map<string, NflverseWeeklyStat[]>();
    for (const row of rows) {
      if (row.season_type !== "REG") continue;
      const gsisId = row.player_id ? normalizeGsisId(row.player_id) : null;
      const week = Number(row.week);
      const pointsPpr = Number(row.fantasy_points_ppr);
      if (!gsisId || !Number.isFinite(week) || !Number.isFinite(pointsPpr)) continue;
      const list = byGsisId.get(gsisId) ?? [];
      list.push({ week, pointsPpr });
      byGsisId.set(gsisId, list);
    }
    return byGsisId;
  })();

  weeklyStatsCache.set(season, promise);
  return promise;
}

// Raw per-player-per-week stat lines — sibling to getNflverseWeeklyStats above, but exposing
// the underlying counting stats instead of nflverse's own precomputed PPR total, so a caller
// can score a week against an arbitrary scoring formula (e.g. an Arc-native league's own
// ScoringSettings) instead of being stuck with standard PPR.
export type NflverseRawWeekStat = {
  week: number;
  passingTds: number;
  passingYards: number;
  passingInterceptions: number;
  rushingTds: number;
  rushingYards: number;
  receivingTds: number;
  receivingYards: number;
  receptions: number;
  fumblesLost: number;
};

// nflverse's schedule `gametime` is a local Eastern wall-clock time (not UTC), and Eastern
// flips between EDT (-04:00) and EST (-05:00) around the first Sunday of November — a
// hardcoded offset would be off by an hour for roughly half the season. Converts by treating
// the given Y-M-D/H:M as if it were UTC, reading what offset America/New_York actually has
// at that approximate instant (safe: the offset lookup only needs to land on the right side
// of the DST transition date, which a same-day few-hour error never crosses), then correcting.
function parseEasternKickoff(dateStr: string, timeStr: string): Date | null {
  const [y, m, d] = (dateStr ?? "").split("-").map(Number);
  const [hh, mm] = (timeStr ?? "").split(":").map(Number);
  if (!y || !m || !d || !Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  const naiveUtc = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "shortOffset",
  }).formatToParts(naiveUtc);
  const offsetLabel = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const offsetHours = Number(offsetLabel.replace("GMT", "")) || -5;

  return new Date(naiveUtc.getTime() - offsetHours * 60 * 60_000);
}

export type NflverseScheduleEntry = { opponent: string; isHome: boolean; kickoffAt: Date };

// games.csv is unversioned and covers every season in one ~2MB file, unlike the per-season
// URLs above — fetch/parse it once regardless of how many seasons get requested, then filter
// per season from the cached rows instead of re-downloading.
let scheduleRowsPromise: Promise<Record<string, string>[]> | null = null;
function getScheduleRows(): Promise<Record<string, string>[]> {
  if (!scheduleRowsPromise) {
    // A rejected promise would otherwise stay cached forever (this module lives for the
    // server process's lifetime) — a single transient network blip would permanently break
    // every lock/schedule check until restart. Clear on failure so the next call retries.
    scheduleRowsPromise = fetchCsv(`${RELEASES_BASE}/schedules/games.csv`).catch((err) => {
      scheduleRowsPromise = null;
      throw err;
    });
  }
  return scheduleRowsPromise;
}

const scheduleCache = new Map<string, Promise<Map<string, Map<number, NflverseScheduleEntry>>>>();

export async function getNflverseSchedule(
  season: string,
): Promise<Map<string, Map<number, NflverseScheduleEntry>>> {
  const cached = scheduleCache.get(season);
  if (cached) return cached;

  const promise = (async () => {
    const rows = await getScheduleRows();
    const byTeamWeek = new Map<string, Map<number, NflverseScheduleEntry>>();
    for (const row of rows) {
      if (row.season !== season || row.game_type !== "REG") continue;
      const week = Number(row.week);
      const kickoffAt = parseEasternKickoff(row.gameday, row.gametime);
      if (!Number.isFinite(week) || !kickoffAt || !row.home_team || !row.away_team) continue;

      const set = (team: string, opponent: string, isHome: boolean) => {
        const weekMap = byTeamWeek.get(team) ?? new Map<number, NflverseScheduleEntry>();
        weekMap.set(week, { opponent, isHome, kickoffAt });
        byTeamWeek.set(team, weekMap);
      };
      set(row.home_team, row.away_team, true);
      set(row.away_team, row.home_team, false);
    }
    return byTeamWeek;
  })().catch((err) => {
    scheduleCache.delete(season);
    throw err;
  });

  scheduleCache.set(season, promise);
  return promise;
}

const rawWeeklyStatsCache = new Map<string, Promise<Map<string, NflverseRawWeekStat[]>>>();

export async function getNflverseRawWeeklyStats(
  season: string,
): Promise<Map<string, NflverseRawWeekStat[]>> {
  const cached = rawWeeklyStatsCache.get(season);
  if (cached) return cached;

  const promise = (async () => {
    const rows = await fetchCsv(`${RELEASES_BASE}/stats_player/stats_player_week_${season}.csv`);
    const byGsisId = new Map<string, NflverseRawWeekStat[]>();
    const num = (v: string) => (v ? Number(v) || 0 : 0);
    for (const row of rows) {
      if (row.season_type !== "REG") continue;
      const gsisId = row.player_id ? normalizeGsisId(row.player_id) : null;
      const week = Number(row.week);
      if (!gsisId || !Number.isFinite(week)) continue;
      const stat: NflverseRawWeekStat = {
        week,
        passingTds: num(row.passing_tds),
        passingYards: num(row.passing_yards),
        passingInterceptions: num(row.passing_interceptions),
        rushingTds: num(row.rushing_tds),
        rushingYards: num(row.rushing_yards),
        receivingTds: num(row.receiving_tds),
        receivingYards: num(row.receiving_yards),
        receptions: num(row.receptions),
        fumblesLost: num(row.fumbles_lost_total),
      };
      const list = byGsisId.get(gsisId) ?? [];
      list.push(stat);
      byGsisId.set(gsisId, list);
    }
    return byGsisId;
  })();

  rawWeeklyStatsCache.set(season, promise);
  return promise;
}
