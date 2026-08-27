import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNflState, getLeagueRosters, getLeagueStarterSlots, getMatchups } from "@/lib/sleeper";
import { getNflverseRosters, getNflverseWeeklyStats, normalizePlayerName } from "@/lib/nflverse";
import { buildRosterRows, computeStandings } from "@/lib/roster";
import { NoLeagueCard } from "@/components/no-league-card";
import { MatchupTabs } from "@/components/matchup/matchup-tabs";
import { MatchupView } from "@/components/matchup/matchup-view";
import { TeamView } from "@/components/matchup/team-view";
import { LeagueView } from "@/components/matchup/league-view";
import { LeadersView, type LeaderPlayer } from "@/components/matchup/leaders-view";
import type { MatchupSide, WeekMatchupPairing } from "@/components/matchup/types";

const WAIVER_ELIGIBLE_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

export default async function MatchupPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; week?: string }>;
}) {
  const authUser = await requireUser();
  const { tab, week: weekParam } = await searchParams;
  const defaultTab =
    tab === "team" || tab === "league" || tab === "leaders" ? tab : "matchup";

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: authUser.id },
    include: { activeLeague: true },
  });

  if (!user.activeLeague) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
          Matchup
        </h1>
        <NoLeagueCard what="your matchup, team, and league" />
      </div>
    );
  }
  const league = user.activeLeague;

  const [state, sleeperRosters, starterSlots, dbRosters, dbPlayers] = await Promise.all([
    getNflState(),
    getLeagueRosters(league.sleeperLeagueId),
    getLeagueStarterSlots(league.sleeperLeagueId).catch(() => [] as string[]),
    prisma.sleeperRoster.findMany({ where: { leagueId: league.id } }),
    prisma.player.findMany({ where: { leagueId: league.id } }),
  ]);

  // Needed early (before the boxscore is built) for projectedPointsFor below. Cached
  // in-memory per season by getNflverseWeeklyStats, so the later Leaders-tab fetch of
  // the same season is a cache hit, not a duplicate network call.
  const nflverseWeeklyStats = await getNflverseWeeklyStats(state.previous_season);

  const dbRosterBySleeperId = new Map(dbRosters.map((r) => [r.sleeperRosterId, r]));
  const dbRosterById = new Map(dbRosters.map((r) => [r.id, r]));
  const playerBySleeperId = new Map(dbPlayers.map((p) => [p.sleeperPlayerId, p]));

  function rosterDisplayName(rosterId: number): string {
    return dbRosterBySleeperId.get(rosterId)?.displayName ?? `Team ${rosterId}`;
  }
  function rosterTeamName(rosterId: number): string {
    const r = dbRosterBySleeperId.get(rosterId);
    return r?.teamName ?? r?.displayName ?? `Team ${rosterId}`;
  }
  function rosterLogoUrl(rosterId: number): string | null {
    const r = dbRosterBySleeperId.get(rosterId);
    if (r?.customLogoUrl) return r.customLogoUrl;
    // avatarUrl is a raw Sleeper avatar-hash ID (from owner.avatar in the Sleeper API),
    // not a full URL — never actually rendered anywhere before this. Real CDN convention:
    // https://sleepercdn.com/avatars/thumbs/{hash}.
    return r?.avatarUrl ? `https://sleepercdn.com/avatars/thumbs/${r.avatarUrl}` : null;
  }

  function buildRows(
    playerIds: string[],
    pointsMap?: Record<string, number> | null,
    withSlots?: boolean,
  ) {
    return buildRosterRows(playerIds, playerBySleeperId, pointsMap, withSlots ? starterSlots : undefined);
  }

  const displayWeek = Math.min(
    Math.max(Number(weekParam) || state.week, 1),
    state.week,
  );

  let matchups: Awaited<ReturnType<typeof getMatchups>> = [];
  try {
    matchups = await getMatchups(league.sleeperLeagueId, state.week);
  } catch {
    matchups = []; // Sleeper hiccup or no schedule yet — same honest empty state either way.
  }

  let boxscoreMatchups = matchups;
  if (displayWeek !== state.week) {
    try {
      boxscoreMatchups = await getMatchups(league.sleeperLeagueId, displayWeek);
    } catch {
      boxscoreMatchups = [];
    }
  }

  // A simple, honest stand-in for real projections (this app has no such data source):
  // each starter's average points-per-game from last season, summed. Players with no
  // resolvable nflverseId or no stat lines are silently excluded, same as everywhere
  // else this app deals with unresolved player data.
  function projectedPointsFor(playerIds: string[]): number {
    return playerIds.reduce((sum, sleeperId) => {
      const gsisId = playerBySleeperId.get(sleeperId)?.nflverseId;
      if (!gsisId) return sum;
      const lines = nflverseWeeklyStats.get(gsisId);
      if (!lines || lines.length === 0) return sum;
      const avg = lines.reduce((s, l) => s + l.pointsPpr, 0) / lines.length;
      return sum + avg;
    }, 0);
  }

  const myRosterDto = sleeperRosters.find((r) => r.owner_id === user.sleeperUserId);
  const myMatchup = myRosterDto
    ? boxscoreMatchups.find((m) => m.roster_id === myRosterDto.roster_id)
    : undefined;
  const opponentMatchup =
    myMatchup && myMatchup.matchup_id !== null
      ? boxscoreMatchups.find(
          (m) => m.matchup_id === myMatchup.matchup_id && m.roster_id !== myRosterDto!.roster_id,
        )
      : undefined;

  const standingsForBoxscore = computeStandings(sleeperRosters, rosterDisplayName);
  function recordFor(rosterId: number) {
    const s = standingsForBoxscore.find((r) => r.sleeperRosterId === rosterId);
    return s ? { wins: s.wins, losses: s.losses, ties: s.ties } : null;
  }

  const myProjected = myMatchup ? projectedPointsFor(myMatchup.starters ?? []) : 0;
  const opponentProjected = opponentMatchup
    ? projectedPointsFor(opponentMatchup.starters ?? [])
    : 0;
  const projectedSum = myProjected + opponentProjected;
  const myWinProbability = projectedSum > 0 ? (myProjected / projectedSum) * 100 : 50;

  const mySide: MatchupSide | null =
    myRosterDto && myMatchup
      ? {
          sleeperRosterId: myRosterDto.roster_id,
          rosterName: rosterTeamName(myRosterDto.roster_id),
          ownerName: rosterDisplayName(myRosterDto.roster_id),
          logoUrl: rosterLogoUrl(myRosterDto.roster_id),
          record: recordFor(myRosterDto.roster_id),
          rows: buildRows(myMatchup.starters ?? [], myMatchup.players_points, true),
          totalPoints: myMatchup.points ?? 0,
          projectedPoints: myProjected,
          winProbability: myWinProbability,
        }
      : null;

  const opponentSide: MatchupSide | null = opponentMatchup
    ? {
        sleeperRosterId: opponentMatchup.roster_id,
        rosterName: rosterTeamName(opponentMatchup.roster_id),
        ownerName: rosterDisplayName(opponentMatchup.roster_id),
        logoUrl: rosterLogoUrl(opponentMatchup.roster_id),
        record: recordFor(opponentMatchup.roster_id),
        rows: buildRows(opponentMatchup.starters ?? [], opponentMatchup.players_points, true),
        totalPoints: opponentMatchup.points ?? 0,
        projectedPoints: opponentProjected,
        winProbability: 100 - myWinProbability,
      }
    : null;

  const myTeamName = myRosterDto ? rosterDisplayName(myRosterDto.roster_id) : null;
  const myStarters = myRosterDto ? buildRows(myRosterDto.starters ?? [], undefined, true) : [];
  const starterSet = new Set(myRosterDto?.starters ?? []);
  const myBench = myRosterDto
    ? buildRows((myRosterDto.players ?? []).filter((pid) => !starterSet.has(pid)))
    : [];

  const standings = computeStandings(sleeperRosters, rosterDisplayName);
  const myStandingIndex = myRosterDto
    ? standings.findIndex((s) => s.sleeperRosterId === myRosterDto.roster_id)
    : -1;
  const myStanding = myStandingIndex >= 0 ? standings[myStandingIndex] : null;
  const myRank = myStandingIndex >= 0 ? myStandingIndex + 1 : null;

  const pairingsByMatchupId = new Map<number, WeekMatchupPairing>();
  for (const m of matchups) {
    if (m.matchup_id === null) continue;
    const existing = pairingsByMatchupId.get(m.matchup_id);
    const side = { sleeperRosterId: m.roster_id, name: rosterDisplayName(m.roster_id), points: m.points ?? 0 };
    if (!existing) {
      pairingsByMatchupId.set(m.matchup_id, { matchupId: m.matchup_id, teamA: side, teamB: null });
    } else {
      existing.teamB = side;
    }
  }
  const pairings = Array.from(pairingsByMatchupId.values());

  // Leaders touches zero Sleeper endpoints at request time — it's driven entirely by nflverse
  // (name, team, position, photo, last-season points) plus our own DB for ownership, not a
  // live Sleeper roster lookup. nflverseWeeklyStats was already fetched above for the
  // boxscore's projected-points calc.
  const nflverseRosters = await getNflverseRosters(state.season);

  // Ownership is attributed by nflverseId -> the DB roster it's linked to, so a leader row can
  // show "who has this player" instead of just excluding rostered players outright. Import-time
  // nflverseId resolution isn't 100% (some players only match Sleeper's own metadata, not
  // nflverse's), so a DB player with no nflverseId would otherwise silently show as "available"
  // even though a real roster owns them — same normalized-name fallback used at import time,
  // plus a broader last-name+position fallback for cases where even the full name differs
  // (e.g. Sleeper's "Kenny Gainwell" vs nflverse's "Kenneth Gainwell").
  function lastNamePositionKey(fullName: string, position: string): string {
    const normalized = normalizePlayerName(fullName);
    const lastName = normalized.split(" ").pop() ?? normalized;
    return `${lastName}|${position}`;
  }

  const ownerNameByNflverseId = new Map<string, string>();
  const ownerNameByFullName = new Map<string, string>();
  const ownerNameByLastNamePosition = new Map<string, string>();
  for (const p of dbPlayers) {
    if (!p.rosterId) continue;
    const roster = dbRosterById.get(p.rosterId);
    if (!roster) continue;
    if (p.nflverseId) {
      ownerNameByNflverseId.set(p.nflverseId, roster.displayName);
      continue;
    }
    ownerNameByFullName.set(normalizePlayerName(p.fullName), roster.displayName);
    ownerNameByLastNamePosition.set(lastNamePositionKey(p.fullName, p.position), roster.displayName);
  }

  function seasonTotalFor(gsisId: string): number | null {
    const lines = nflverseWeeklyStats.get(gsisId);
    if (!lines || lines.length === 0) return null;
    return lines.reduce((sum, l) => sum + l.pointsPpr, 0);
  }

  const allPlayers: LeaderPlayer[] = Array.from(nflverseRosters.byGsisId.values())
    .filter((p) => {
      if (!p.position || !WAIVER_ELIGIBLE_POSITIONS.has(p.position)) return false;
      return !!p.team;
    })
    .map((p) => ({
      nflverseId: p.gsisId,
      headshotUrl: p.headshotUrl,
      name: p.fullName,
      team: p.team,
      position: p.position!,
      lastSeasonPoints: seasonTotalFor(p.gsisId),
      ownerName:
        ownerNameByNflverseId.get(p.gsisId) ??
        ownerNameByFullName.get(normalizePlayerName(p.fullName)) ??
        ownerNameByLastNamePosition.get(lastNamePositionKey(p.fullName, p.position!)) ??
        null,
    }))
    .sort((a, b) => (b.lastSeasonPoints ?? 0) - (a.lastSeasonPoints ?? 0));

  return (
    <div className="relative flex flex-col gap-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40vh]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 100% at 50% 0%, color-mix(in srgb, var(--positive) 10%, transparent), transparent 70%)",
        }}
      />
      <div>
        <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
          {league.name}
        </h1>
        <p className="text-sm text-muted-foreground">Week {state.week}</p>
      </div>
      <MatchupTabs
        defaultTab={defaultTab}
        matchupSlot={
          <MatchupView week={displayWeek} maxWeek={state.week} mine={mySide} opponent={opponentSide} />
        }
        teamSlot={
          <TeamView
            teamName={myTeamName}
            starters={myStarters}
            bench={myBench}
            isOwnTeam
            record={myStanding ? { wins: myStanding.wins, losses: myStanding.losses, ties: myStanding.ties } : null}
            rank={myRank}
            totalTeams={standings.length}
          />
        }
        leagueSlot={<LeagueView week={state.week} standings={standings} pairings={pairings} />}
        leadersSlot={<LeadersView players={allPlayers} previousSeason={state.previous_season} />}
      />
    </div>
  );
}
