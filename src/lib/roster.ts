import "server-only";
import type { SleeperRosterDTO } from "@/lib/sleeper";
import type { RosterPlayerRowData } from "@/components/matchup/roster-player-row";
import type { StandingsRow } from "@/components/matchup/types";

type DbPlayerLite = {
  id: string;
  headshotUrl: string | null;
  fullName: string;
  team: string | null;
  position: string;
  currentPrice: number | { toString(): string };
};

// Shared by the Matchup page's "my team" view and the standalone /matchup/team/[rosterId]
// route (any team) — same Sleeper roster-player-id list, same DB player lookup, same shape.
export function buildRosterRows(
  playerIds: string[],
  playerBySleeperId: Map<string, DbPlayerLite>,
  pointsMap?: Record<string, number> | null,
  slots?: string[], // parallel array, same order as playerIds — lineup slot per starter
): RosterPlayerRowData[] {
  return playerIds.map((pid, i) => {
    const p = playerBySleeperId.get(pid);
    return {
      playerId: p?.id ?? null,
      sleeperPlayerId: pid,
      headshotUrl: p?.headshotUrl ?? null,
      name: p?.fullName ?? pid,
      team: p?.team ?? null,
      position: p?.position ?? "UNK",
      price: p ? Number(p.currentPrice) : null,
      points: pointsMap?.[pid] ?? null,
      slot: slots?.[i] ?? null,
    };
  });
}

// Shared by every place a SleeperRoster's logo is displayed (Matchup card, Team/roster
// views). customLogoUrl (user-uploaded, see team-logo.ts) wins when set; otherwise
// avatarUrl is a raw Sleeper avatar-hash ID, not a full URL — construct the real CDN URL.
export function resolveTeamLogoUrl(roster: {
  customLogoUrl: string | null;
  avatarUrl: string | null;
}): string | null {
  if (roster.customLogoUrl) return roster.customLogoUrl;
  return roster.avatarUrl ? `https://sleepercdn.com/avatars/thumbs/${roster.avatarUrl}` : null;
}

function fptsOf(settings: SleeperRosterDTO["settings"]): number {
  if (!settings) return 0;
  return settings.fpts + (settings.fpts_decimal ?? 0) / 100;
}

export function computeStandings(
  sleeperRosters: SleeperRosterDTO[],
  rosterDisplayName: (rosterId: number) => string,
): StandingsRow[] {
  return sleeperRosters
    .map((r) => ({
      sleeperRosterId: r.roster_id,
      name: rosterDisplayName(r.roster_id),
      wins: r.settings?.wins ?? 0,
      losses: r.settings?.losses ?? 0,
      ties: r.settings?.ties ?? 0,
      pointsFor: fptsOf(r.settings),
    }))
    .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);
}
