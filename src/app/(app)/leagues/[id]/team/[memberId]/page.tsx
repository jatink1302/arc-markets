import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNflState } from "@/lib/sleeper";
import { getNflverseRosters, getNflverseSchedule, getNflverseWeeklyStats } from "@/lib/nflverse";
import { computeSeasonStandings } from "@/lib/fantasy-scoring";
import { buildSeasonScoringContext } from "@/lib/league-scoring-context";
import { buildStarterRows } from "@/lib/native-starters";
import { SEASON_WEEKS } from "@/lib/fantasy-schedule";
import { resolveNativeMemberLogoUrls } from "@/lib/roster";
import { TeamAvatar } from "@/components/matchup/team-avatar";
import { WeekSelect } from "../../week-select";
import { StartersView } from "../../starters-view";

// Isolated from the page component body on purpose — react-hooks/purity flags a direct
// Date.now() call inside a component's render, even a Server Component's.
function nowMs(): number {
  return Date.now();
}

type TeamScheduleWeekRow = {
  week: number;
  opponentMemberId: string | null; // null = bye
  opponentTeamName: string | null;
  myPoints: number | null; // null = not yet played
  opponentPoints: number | null; // null = not yet played, or bye
  result: "W" | "L" | "T" | "BYE" | "UPCOMING";
};

export default async function TeamSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; memberId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id, memberId } = await params;
  const { week: weekParam } = await searchParams;
  const authUser = await requireUser();

  const league = await prisma.fantasyLeague.findUnique({
    where: { id },
    include: {
      members: {
        include: { user: { select: { id: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      picks: { orderBy: { pickNo: "asc" } },
      matchups: { orderBy: { week: "asc" } },
      weeklyStarters: true,
    },
  });
  if (!league) notFound();

  const me = league.members.find((m) => m.userId === authUser.id);
  if (!me) redirect("/leagues/join");

  // Standings/Rosters are the only entry points and only render once ACTIVE — a direct URL
  // hit while FORMING/DRAFTING would otherwise hit meaningless/empty scoring context.
  if (league.status !== "ACTIVE") redirect(`/leagues/${id}`);

  const targetMember = league.members.find((m) => m.id === memberId);
  if (!targetMember) notFound();
  const isOwner = targetMember.userId === authUser.id;

  const teamNameByMember = new Map(
    league.members.map((m) => [m.id, m.teamName ?? m.user?.email ?? "Unclaimed Team"]),
  );
  const logoUrlByMember = await resolveNativeMemberLogoUrls(
    league.members.map((m) => ({ id: m.id, sleeperRosterId: m.sleeperRosterId })),
    league.sourceSleeperLeagueId,
  );

  const liveState = await getNflState();
  const ctx = await buildSeasonScoringContext(
    {
      season: league.season,
      picks: league.picks,
      rosterSettings: league.rosterSettings,
      scoringSettings: league.scoringSettings,
      matchups: league.matchups.map((m) => ({
        week: m.week,
        memberAId: m.memberAId,
        memberBId: m.memberBId,
        importedPointsA: m.importedPointsA !== null ? Number(m.importedPointsA) : null,
        importedPointsB: m.importedPointsB !== null ? Number(m.importedPointsB) : null,
      })),
      weeklyStarters: league.weeklyStarters.map((w) => ({
        memberId: w.memberId,
        week: w.week,
        pickId: w.pickId,
      })),
    },
    liveState,
  );

  const selectedWeek = weekParam
    ? Math.min(Math.max(Number(weekParam) || 1, 1), SEASON_WEEKS)
    : ctx.clampedCurrentWeek;

  const record = computeSeasonStandings(
    league.members.map((m) => m.id),
    league.matchups,
    (mId, week) => ctx.weekScoreFor(mId, week),
    ctx.hasStarted ? ctx.clampedCurrentWeek : 0,
  ).find((r) => r.memberId === memberId);

  const myMatchups = league.matchups.filter(
    (m) => m.memberAId === memberId || m.memberBId === memberId,
  );

  const weeks: TeamScheduleWeekRow[] = [];
  for (let week = 1; week <= SEASON_WEEKS; week++) {
    const matchup = myMatchups.find((m) => m.week === week);
    const opponentId = matchup
      ? matchup.memberAId === memberId
        ? matchup.memberBId
        : matchup.memberAId
      : null;

    const played = ctx.hasStarted && week <= ctx.clampedCurrentWeek;

    if (!matchup || !opponentId) {
      weeks.push({
        week,
        opponentMemberId: null,
        opponentTeamName: null,
        myPoints: played ? ctx.weekScoreFor(memberId, week) : null,
        opponentPoints: null,
        result: played ? "BYE" : "UPCOMING",
      });
      continue;
    }

    if (!played) {
      weeks.push({
        week,
        opponentMemberId: opponentId,
        opponentTeamName: teamNameByMember.get(opponentId) ?? "Unknown",
        myPoints: null,
        opponentPoints: null,
        result: "UPCOMING",
      });
      continue;
    }

    const myPoints = ctx.weekScoreFor(memberId, week);
    const opponentPoints = ctx.weekScoreFor(opponentId, week);
    weeks.push({
      week,
      opponentMemberId: opponentId,
      opponentTeamName: teamNameByMember.get(opponentId) ?? "Unknown",
      myPoints,
      opponentPoints,
      result: myPoints > opponentPoints ? "W" : myPoints < opponentPoints ? "L" : "T",
    });
  }

  const [nflverseRosters, schedule, previousSeasonStats] = await Promise.all([
    getNflverseRosters(league.season),
    getNflverseSchedule(league.season),
    getNflverseWeeklyStats(liveState.previous_season),
  ]);

  const importedMatchup = league.matchups.find(
    (m) => m.week === selectedWeek && (m.memberAId === memberId || m.memberBId === memberId),
  );
  const isImportedWeek = importedMatchup
    ? (importedMatchup.memberAId === memberId
        ? importedMatchup.importedPointsA
        : importedMatchup.importedPointsB) !== null
    : false;
  const starterRows = buildStarterRows({
    ctx,
    memberId,
    week: selectedWeek,
    isOwner,
    isImportedWeek,
    nflverseRosters,
    schedule,
    previousSeasonStats,
    now: nowMs(),
  });

  return (
    <div className="flex flex-col items-center gap-4">
      {/* SeasonView's tabs aren't URL-synced, so this always lands back on Matchup —
          known limitation, not worth the scope increase of URL-syncing the tab state. */}
      <Link
        href={`/leagues/${id}`}
        className="self-start text-sm text-muted-foreground hover:text-foreground"
      >
        ← {league.name}
      </Link>

      <div className="flex w-full max-w-2xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <TeamAvatar
            sleeperRosterId={null}
            name={targetMember.teamName ?? targetMember.user?.email ?? "Unclaimed Team"}
            logoUrl={logoUrlByMember.get(targetMember.id) ?? null}
            accent="positive"
            size="sm"
          />
          <div>
            <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
              {targetMember.teamName ?? targetMember.user?.email ?? "Unclaimed Team"}
            </h1>
            {record && (
              <p className="font-mono text-xs text-muted-foreground">
                {record.wins}-{record.losses}
                {record.ties > 0 ? `-${record.ties}` : ""} · {record.pointsFor.toFixed(1)} PF ·{" "}
                {record.pointsAgainst.toFixed(1)} PA
              </p>
            )}
          </div>
        </div>

        <WeekSelect
          basePath={`/leagues/${id}/team/${memberId}`}
          week={selectedWeek}
          seasonWeeks={SEASON_WEEKS}
        />

        <StartersView
          leagueId={id}
          week={selectedWeek}
          starters={starterRows}
          isImportedWeek={isImportedWeek}
        />

        <div className="rounded-lg border border-border bg-card">
          <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
            Schedule
          </h3>
          <div className="flex flex-col divide-y divide-border/60">
            {weeks.map((row) => (
              <div
                key={row.week}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 font-mono text-xs text-muted-foreground">
                    {row.week}
                  </span>
                  <span className="text-sm text-foreground">
                    {row.opponentTeamName ?? "Bye"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {row.result === "UPCOMING" ? (
                    <span className="text-xs text-muted-foreground">Upcoming</span>
                  ) : row.result === "BYE" ? (
                    <span className="text-xs text-muted-foreground">Bye</span>
                  ) : (
                    <>
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.myPoints?.toFixed(1)} – {row.opponentPoints?.toFixed(1)}
                      </span>
                      <span
                        className={
                          "w-5 shrink-0 text-center font-mono text-xs font-semibold " +
                          (row.result === "W"
                            ? "text-primary"
                            : row.result === "L"
                              ? "text-negative"
                              : "text-muted-foreground")
                        }
                      >
                        {row.result}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
