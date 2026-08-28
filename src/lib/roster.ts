import "server-only";
import { prisma } from "@/lib/prisma";
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

// A native FantasyLeagueMember has no direct DB relation to a SleeperRoster — only a loose
// sleeperRosterId value set at conversion time (see fantasy-league-conversion.ts). Resolves
// the real logo for each member of a converted league in one batched round trip (no logo,
// i.e. a from-scratch native league or an unlinked member, resolves to null for everyone).
export async function resolveNativeMemberLogoUrls(
  members: { id: string; sleeperRosterId: number | null }[],
  sourceSleeperLeagueId: string | null,
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  if (!sourceSleeperLeagueId) return result;

  const sourceLeague = await prisma.league.findUnique({ where: { sleeperLeagueId: sourceSleeperLeagueId } });
  if (!sourceLeague) return result;

  const rosterIds = members
    .map((m) => m.sleeperRosterId)
    .filter((id): id is number => id != null);
  if (rosterIds.length === 0) return result;

  const sleeperRosters = await prisma.sleeperRoster.findMany({
    where: { leagueId: sourceLeague.id, sleeperRosterId: { in: rosterIds } },
  });
  const bySleeperRosterId = new Map(sleeperRosters.map((r) => [r.sleeperRosterId, r]));

  for (const m of members) {
    if (m.sleeperRosterId == null) continue;
    const roster = bySleeperRosterId.get(m.sleeperRosterId);
    if (roster) result.set(m.id, resolveTeamLogoUrl(roster));
  }
  return result;
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
