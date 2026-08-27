// Sleeper's public API — no auth required. See https://docs.sleeper.com/

const BASE = "https://api.sleeper.app/v1";

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
};

export type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  avatar: string | null;
};

export type SleeperRosterDTO = {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  settings: {
    wins: number;
    losses: number;
    ties: number;
    fpts: number;
    fpts_decimal?: number;
    fpts_against?: number;
    fpts_against_decimal?: number;
  } | null;
};

export type SleeperMatchup = {
  roster_id: number;
  matchup_id: number | null;
  points: number | null;
  starters: string[] | null;
  starters_points: number[] | null;
  players_points: Record<string, number> | null;
};

export type SleeperLeagueUser = {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata: { team_name?: string } | null;
};

export type SleeperPlayer = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  team: string | null;
  position: string | null;
  // Cross-reference id into other systems — this is how we bridge to nflverse's
  // independent player data without depending on Sleeper for the data itself.
  gsis_id: string | null;
};

async function sleeperFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    // Sleeper data changes slowly enough that a short cache is safe and polite.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    if (res.status === 404) {
      throw new SleeperNotFoundError(path);
    }
    throw new Error(`Sleeper API ${path} failed: ${res.status}`);
  }
  return res.json();
}

export class SleeperNotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
    this.name = "SleeperNotFoundError";
  }
}

export type SleeperState = {
  season: string;
  previous_season: string;
  week: number;
  season_type: string;
};

export async function getNflState(): Promise<SleeperState> {
  return sleeperFetch<SleeperState>("/state/nfl");
}

export async function getCurrentNflSeason(): Promise<string> {
  const state = await getNflState();
  return state.season;
}

export async function getSleeperUserByUsername(
  username: string,
): Promise<SleeperUser> {
  return sleeperFetch<SleeperUser>(`/user/${encodeURIComponent(username)}`);
}

export async function getUserLeagues(
  sleeperUserId: string,
  season: string,
): Promise<SleeperLeague[]> {
  return sleeperFetch<SleeperLeague[]>(
    `/user/${sleeperUserId}/leagues/nfl/${season}`,
  );
}

export async function getLeagueRosters(
  leagueId: string,
): Promise<SleeperRosterDTO[]> {
  return sleeperFetch<SleeperRosterDTO[]>(`/league/${leagueId}/rosters`);
}

// `roster_positions` lists every roster spot in order — starter slots first (QB/RB/WR/.../FLEX/
// SUPER_FLEX/DEF/K), then one "BN" per bench spot, then "IR"/"TAXI" if the league uses them. A
// roster's `starters` array lines up 1:1, in order, with just the non-BN/IR/TAXI entries here —
// that's what lets a starter be labeled by lineup slot (e.g. "FLEX") instead of just position.
export async function getLeagueStarterSlots(leagueId: string): Promise<string[]> {
  const league = await sleeperFetch<{ roster_positions: string[] }>(`/league/${leagueId}`);
  return league.roster_positions.filter((p) => p !== "BN" && p !== "IR" && p !== "TAXI");
}

// Full roster/scoring/schedule shape a Sleeper-to-native league conversion needs —
// separate from getLeagueStarterSlots above, which only needs roster_positions.
export type SleeperLeagueSettings = {
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  // type: 0 = redraft/season league, 2 = dynasty (1 = keeper, which Summit has no
  // concept of — treated as REDRAFT, see fantasy-league-conversion.ts).
  settings: { playoff_week_start: number; type?: number };
};

export async function getSleeperLeagueSettings(leagueId: string): Promise<SleeperLeagueSettings> {
  return sleeperFetch<SleeperLeagueSettings>(`/league/${leagueId}`);
}

export async function getLeagueUsers(
  leagueId: string,
): Promise<SleeperLeagueUser[]> {
  return sleeperFetch<SleeperLeagueUser[]>(`/league/${leagueId}/users`);
}

// Empty array is a real, common response — it means the league hasn't had its
// schedule generated yet (e.g. still pre-draft), not an error. Callers must treat
// that as "no matchup this week" rather than retrying or treating it as a failure.
export async function getMatchups(
  leagueId: string,
  week: number,
): Promise<SleeperMatchup[]> {
  return sleeperFetch<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`);
}

// The full /players/nfl dump is ~5MB and Sleeper asks that it not be fetched more
// than once a day per client. We cache it in-memory (per server instance) and only
// ever read it during a league import, to resolve player_id -> name/team/position
// for the (small) set of players actually on that league's rosters.
let playersCache: { data: Record<string, SleeperPlayer>; fetchedAt: number } | null =
  null;
const PLAYERS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function getAllPlayersMap(): Promise<Record<string, SleeperPlayer>> {
  if (playersCache && Date.now() - playersCache.fetchedAt < PLAYERS_CACHE_TTL_MS) {
    return playersCache.data;
  }
  const data = await sleeperFetch<Record<string, SleeperPlayer>>("/players/nfl");
  playersCache = { data, fetchedAt: Date.now() };
  return data;
}

export function sleeperPlayerDisplayName(p: SleeperPlayer, fallbackId: string): string {
  return p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || fallbackId;
}
