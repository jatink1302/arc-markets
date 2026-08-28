import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLeagueRosters, getLeagueStarterSlots } from "@/lib/sleeper";
import { buildRosterRows, computeStandings, resolveTeamLogoUrl } from "@/lib/roster";
import { NoLeagueCard } from "@/components/no-league-card";
import { TeamView } from "@/components/matchup/team-view";

const BACK_TARGETS: Record<string, { href: string; label: string }> = {
  league: { href: "/matchup?tab=league", label: "Back to League" },
  matchup: { href: "/matchup?tab=matchup", label: "Back to Matchup" },
};

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ rosterId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const authUser = await requireUser();
  const { rosterId } = await params;
  const { from } = await searchParams;
  const targetRosterId = Number(rosterId);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: authUser.id },
    include: { activeLeague: true },
  });

  if (!user.activeLeague) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">Team</h1>
        <NoLeagueCard what="team rosters" />
      </div>
    );
  }
  const league = user.activeLeague;

  const [sleeperRosters, starterSlots, dbRosters, dbPlayers] = await Promise.all([
    getLeagueRosters(league.sleeperLeagueId),
    getLeagueStarterSlots(league.sleeperLeagueId).catch(() => [] as string[]),
    prisma.sleeperRoster.findMany({ where: { leagueId: league.id } }),
    prisma.player.findMany({ where: { leagueId: league.id } }),
  ]);

  const targetRosterDto = sleeperRosters.find((r) => r.roster_id === targetRosterId);
  if (!targetRosterDto) notFound();

  const dbRosterBySleeperId = new Map(dbRosters.map((r) => [r.sleeperRosterId, r]));
  const playerBySleeperId = new Map(dbPlayers.map((p) => [p.sleeperPlayerId, p]));

  function rosterDisplayName(id: number): string {
    return dbRosterBySleeperId.get(id)?.displayName ?? `Team ${id}`;
  }
  function rosterLogoUrl(id: number): string | null {
    const r = dbRosterBySleeperId.get(id);
    return r ? resolveTeamLogoUrl(r) : null;
  }

  const teamName = rosterDisplayName(targetRosterDto.roster_id);
  const targetDbRoster = dbRosterBySleeperId.get(targetRosterDto.roster_id);
  const logoUrl = targetDbRoster ? resolveTeamLogoUrl(targetDbRoster) : null;
  const starterSet = new Set(targetRosterDto.starters ?? []);
  const starters = buildRosterRows(
    targetRosterDto.starters ?? [],
    playerBySleeperId,
    undefined,
    starterSlots,
  );
  const bench = buildRosterRows(
    (targetRosterDto.players ?? []).filter((pid) => !starterSet.has(pid)),
    playerBySleeperId,
  );

  const standings = computeStandings(sleeperRosters, rosterDisplayName, rosterLogoUrl);
  const standingIndex = standings.findIndex((s) => s.sleeperRosterId === targetRosterId);
  const standing = standingIndex >= 0 ? standings[standingIndex] : null;
  const rank = standingIndex >= 0 ? standingIndex + 1 : null;

  const back = (from ? BACK_TARGETS[from] : undefined) ?? BACK_TARGETS.league;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <TeamView
        teamName={teamName}
        sleeperRosterId={targetRosterDto.roster_id}
        logoUrl={logoUrl}
        starters={starters}
        bench={bench}
        isOwnTeam={targetRosterDto.owner_id === user.sleeperUserId}
        record={standing ? { wins: standing.wins, losses: standing.losses, ties: standing.ties } : null}
        rank={rank}
        totalTeams={standings.length}
        backHref={back.href}
        backLabel={back.label}
      />
    </div>
  );
}
