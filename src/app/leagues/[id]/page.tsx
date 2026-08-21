import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNflState } from "@/lib/sleeper";
import { getNflverseRosters, getNflverseWeeklyStats } from "@/lib/nflverse";
import { computeFantasyPoints, computeSeasonStandings } from "@/lib/fantasy-scoring";
import { buildSeasonScoringContext } from "@/lib/league-scoring-context";
import { SEASON_WEEKS } from "@/lib/fantasy-schedule";
import { LeagueFormingView } from "./league-forming-view";
import { DraftBoard, type DraftablePlayer } from "./draft-board";
import { LeagueRostersView } from "./league-rosters-view";
import { SeasonView } from "./season-view";
import { SeasonMatchupView, type SeasonMatchupSide } from "./season-matchup-view";
import { SeasonStandingsView } from "./season-standings-view";
import { TradesView, type TradeRowData } from "./trades-view";
import { FreeAgentsView, type FreeAgentPlayer } from "./free-agents-view";
import { ActivityView, type ActivityEntry } from "./activity-view";
import { totalRosterSlots, type RosterSettings, type ScoringSettings } from "@/lib/fantasy-defaults";

const DRAFT_ELIGIBLE_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id } = await params;
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
    },
  });
  if (!league) notFound();

  const me = league.members.find((m) => m.userId === authUser.id);
  if (!me) redirect("/leagues/join");

  const members = league.members.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    teamName: m.teamName,
    email: m.user.email,
  }));

  const liveState = await getNflState();

  let availablePlayers: DraftablePlayer[] = [];
  if (league.status === "DRAFTING") {
    const state = liveState;
    const [nflverseRosters, nflverseWeeklyStats] = await Promise.all([
      getNflverseRosters(state.season),
      getNflverseWeeklyStats(state.previous_season),
    ]);
    const draftedIds = new Set(league.picks.map((p) => p.nflverseId));

    function seasonTotalFor(gsisId: string): number | null {
      const lines = nflverseWeeklyStats.get(gsisId);
      if (!lines || lines.length === 0) return null;
      return lines.reduce((sum, l) => sum + l.pointsPpr, 0);
    }

    availablePlayers = Array.from(nflverseRosters.byGsisId.values())
      .filter((p) => {
        if (!p.position || !DRAFT_ELIGIBLE_POSITIONS.has(p.position)) return false;
        if (!p.team) return false;
        return !draftedIds.has(p.gsisId);
      })
      .map((p) => ({
        nflverseId: p.gsisId,
        headshotUrl: p.headshotUrl,
        name: p.fullName,
        team: p.team,
        position: p.position!,
        lastSeasonPoints: seasonTotalFor(p.gsisId),
      }))
      .sort((a, b) => (b.lastSeasonPoints ?? 0) - (a.lastSeasonPoints ?? 0));
  }

  let seasonSlots: {
    matchup: React.ReactNode;
    standings: React.ReactNode;
    rosters: React.ReactNode;
    trades: React.ReactNode;
    freeAgents: React.ReactNode;
    activity: React.ReactNode;
  } | null = null;

  if (league.status === "ACTIVE") {
    const [ctx, nflverseRosters] = await Promise.all([
      buildSeasonScoringContext(
        {
          season: league.season,
          picks: league.picks,
          rosterSettings: league.rosterSettings,
          scoringSettings: league.scoringSettings,
        },
        liveState,
      ),
      getNflverseRosters(league.season),
    ]);

    const selectedWeek = weekParam
      ? Math.min(Math.max(Number(weekParam) || 1, 1), SEASON_WEEKS)
      : ctx.clampedCurrentWeek;

    const teamNameByMember = new Map(
      league.members.map((m) => [m.id, m.teamName ?? m.user.email]),
    );

    function lineupFor(memberId: string, week: number): SeasonMatchupSide {
      const lineup = ctx.lineupFor(memberId, week);
      return {
        memberId,
        teamName: teamNameByMember.get(memberId) ?? "Unknown",
        starters: lineup.starters,
        totalPoints: lineup.totalPoints,
      };
    }

    const myMatchupRow = league.matchups.find(
      (m) => m.week === selectedWeek && (m.memberAId === me.id || m.memberBId === me.id),
    );
    const opponentId = myMatchupRow
      ? myMatchupRow.memberAId === me.id
        ? myMatchupRow.memberBId
        : myMatchupRow.memberAId
      : undefined;

    const matchupSlot = (
      <SeasonMatchupView
        leagueId={league.id}
        week={selectedWeek}
        seasonWeeks={SEASON_WEEKS}
        hasStarted={ctx.hasStarted}
        mine={ctx.hasStarted && myMatchupRow ? lineupFor(me.id, selectedWeek) : null}
        opponent={
          ctx.hasStarted && myMatchupRow && opponentId ? lineupFor(opponentId, selectedWeek) : null
        }
      />
    );

    const standingsThroughWeek = ctx.hasStarted ? ctx.clampedCurrentWeek : 0;
    const standings = computeSeasonStandings(
      league.members.map((m) => m.id),
      league.matchups,
      (memberId, week) => lineupFor(memberId, week).totalPoints,
      standingsThroughWeek,
    ).map((row) => ({ ...row, teamName: teamNameByMember.get(row.memberId) ?? "Unknown" }));

    const standingsSlot = <SeasonStandingsView leagueId={league.id} rows={standings} />;

    const rosteredNflverseIds = new Set(ctx.activePicks.map((p) => p.nflverseId));

    function seasonPointsFor(gsisId: string): number {
      const lines = ctx.weekStats.get(gsisId);
      if (!lines || lines.length === 0) return 0;
      return lines.reduce((sum, l) => sum + computeFantasyPoints(l, ctx.scoringSettings), 0);
    }

    const freeAgents: FreeAgentPlayer[] = Array.from(nflverseRosters.byGsisId.values())
      .filter((p) => {
        if (!p.position || !DRAFT_ELIGIBLE_POSITIONS.has(p.position)) return false;
        if (!p.team) return false;
        return !rosteredNflverseIds.has(p.gsisId);
      })
      .map((p) => ({
        nflverseId: p.gsisId,
        headshotUrl: p.headshotUrl,
        name: p.fullName,
        team: p.team,
        position: p.position!,
        seasonPoints: seasonPointsFor(p.gsisId),
      }))
      .sort((a, b) => b.seasonPoints - a.seasonPoints);

    const myActivePicks = ctx.picksByMember.get(me.id) ?? [];
    const rosterCap = totalRosterSlots(ctx.rosterSettings);

    const freeAgentsSlot = (
      <FreeAgentsView
        leagueId={league.id}
        availablePlayers={freeAgents}
        myPicks={myActivePicks.map((p) => ({
          id: p.id,
          playerName: p.playerName,
          playerPosition: p.playerPosition,
        }))}
        rosterCap={rosterCap}
        myActivePickCount={myActivePicks.length}
      />
    );

    const trades = await prisma.fantasyTrade.findMany({
      where: { leagueId: id },
      include: { items: { include: { pick: true } } },
      orderBy: { createdAt: "desc" },
    });
    const tradeRows: TradeRowData[] = trades.map((t) => ({
      id: t.id,
      status: t.status,
      proposerName: teamNameByMember.get(t.proposerId) ?? "Unknown",
      recipientName: teamNameByMember.get(t.recipientId) ?? "Unknown",
      items: t.items.map((item) => ({
        playerName: item.pick.playerName,
        playerPosition: item.pick.playerPosition,
        fromMemberName: teamNameByMember.get(item.fromMemberId) ?? "Unknown",
      })),
      isIncoming: t.recipientId === me.id,
      isOutgoing: t.proposerId === me.id,
    }));
    const tradesSlot = (
      <TradesView
        pending={tradeRows.filter((t) => t.status === "PENDING")}
        history={tradeRows.filter((t) => t.status !== "PENDING")}
      />
    );

    // Built from the raw, unfiltered league.picks (not ctx.activePicks) — a dropped
    // player's original "added" event must stay in history even after the row's
    // droppedAt is set. Only ACCEPTED trades count as a transaction; pending/rejected/
    // cancelled ones never changed a roster and already live in the Trades tab's history.
    const activityEntries: ActivityEntry[] = [];
    for (const p of league.picks) {
      activityEntries.push({
        id: `${p.id}-added`,
        type: p.source === "DRAFT" ? "DRAFT_PICK" : "FREE_AGENT_ADD",
        at: p.pickedAt,
        teamName: teamNameByMember.get(p.memberId) ?? "Unknown",
        playerName: p.playerName,
        playerPosition: p.playerPosition,
        playerTeam: p.playerTeam,
        round: p.round,
      });
      if (p.droppedAt) {
        activityEntries.push({
          id: `${p.id}-dropped`,
          type: "DROP",
          at: p.droppedAt,
          teamName: teamNameByMember.get(p.memberId) ?? "Unknown",
          playerName: p.playerName,
          playerPosition: p.playerPosition,
          playerTeam: p.playerTeam,
        });
      }
    }
    for (const t of trades) {
      if (t.status !== "ACCEPTED") continue;
      activityEntries.push({
        id: t.id,
        type: "TRADE",
        at: t.respondedAt ?? t.createdAt,
        items: t.items.map((item) => ({
          playerName: item.pick.playerName,
          playerPosition: item.pick.playerPosition,
          fromTeamName: teamNameByMember.get(item.fromMemberId) ?? "Unknown",
          toTeamName:
            teamNameByMember.get(
              item.fromMemberId === t.proposerId ? t.recipientId : t.proposerId,
            ) ?? "Unknown",
        })),
      });
    }
    activityEntries.sort((a, b) => b.at.getTime() - a.at.getTime());
    const activitySlot = <ActivityView entries={activityEntries} />;

    const rostersSlot = (
      <LeagueRostersView
        leagueId={league.id}
        myMemberId={me.id}
        members={members}
        picks={ctx.activePicks}
      />
    );

    seasonSlots = {
      matchup: matchupSlot,
      standings: standingsSlot,
      rosters: rostersSlot,
      trades: tradesSlot,
      freeAgents: freeAgentsSlot,
      activity: activitySlot,
    };
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-4">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <Link
          href="/leagues"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← My Leagues
        </Link>
        <Link
          href={`/leagues/${league.id}/chat`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          💬 Chat
        </Link>
      </div>

      {league.status === "FORMING" && (
        <LeagueFormingView
          leagueId={league.id}
          name={league.name}
          inviteCode={league.inviteCode}
          rosterSettings={league.rosterSettings as unknown as RosterSettings}
          scoringSettings={league.scoringSettings as unknown as ScoringSettings}
          season={league.season}
          liveSeason={liveState.season}
          members={members}
          isCommissioner={me.role === "COMMISSIONER"}
          currentUserId={authUser.id}
        />
      )}

      {league.status === "DRAFTING" && (
        <DraftBoard
          leagueId={league.id}
          members={members}
          draftOrder={(league.draftOrder as string[] | null) ?? []}
          currentPickNo={league.currentPickNo}
          rosterSettings={league.rosterSettings as unknown as RosterSettings}
          picks={league.picks}
          availablePlayers={availablePlayers}
          currentUserId={authUser.id}
        />
      )}

      {league.status === "ACTIVE" && seasonSlots && (
        <div className="flex w-full max-w-2xl flex-col gap-4">
          <h1 className="font-heading text-3xl uppercase tracking-wide text-foreground">
            {league.name}
          </h1>
          <SeasonView
            matchupSlot={seasonSlots.matchup}
            standingsSlot={seasonSlots.standings}
            rostersSlot={seasonSlots.rosters}
            tradesSlot={seasonSlots.trades}
            freeAgentsSlot={seasonSlots.freeAgents}
            activitySlot={seasonSlots.activity}
          />
        </div>
      )}
    </main>
  );
}
