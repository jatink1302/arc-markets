import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyStateCard } from "@/components/empty-state-card";
import { ConvertLeagueButton } from "@/app/(app)/leagues/convert-league-button";
import { ClaimTeamCard } from "@/app/(app)/leagues/claim-team-card";

const STATUS_LABELS: Record<string, string> = {
  FORMING: "Forming",
  DRAFTING: "Drafting",
  ACTIVE: "Active",
};

const LEAGUE_TYPE_LABELS: Record<string, string> = {
  REDRAFT: "Redraft",
  DYNASTY: "Dynasty",
};

export default async function HomePage() {
  const authUser = await requireUser();

  const [memberships, user] = await Promise.all([
    prisma.fantasyLeagueMember.findMany({
      where: { userId: authUser.id },
      include: { league: true },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.user.findUnique({
      where: { id: authUser.id },
      include: { activeLeague: true },
    }),
  ]);
  const sleeperLeague = user?.activeLeague ?? null;

  const [convertedLeague, unclaimedTeams] = await Promise.all([
    sleeperLeague
      ? prisma.fantasyLeague.findUnique({
          where: { sourceSleeperLeagueId: sleeperLeague.sleeperLeagueId },
        })
      : null,
    user?.sleeperUserId
      ? prisma.fantasyLeagueMember.findMany({
          where: { userId: null, sleeperOwnerId: user.sleeperUserId },
          include: { league: { select: { id: true, name: true } } },
        })
      : [],
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl">
        {unclaimedTeams.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {unclaimedTeams.map((m) => (
              <ClaimTeamCard
                key={m.id}
                memberId={m.id}
                teamName={m.teamName ?? "Your team"}
                leagueName={m.league.name}
              />
            ))}
          </div>
        )}

        <div className="mt-2 mb-4 flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
            Fantasy Leagues
          </h1>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/leagues/new"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Start
            </Link>
            <Link
              href="/leagues/join"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Join
            </Link>
          </div>
        </div>

        {sleeperLeague && (
          <div className="mb-4 flex flex-col gap-2">
            <h2 className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
              Sleeper league
            </h2>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <Link href="/matchup" className="min-w-0 flex-1 hover:opacity-80">
                <div className="truncate text-sm font-medium text-foreground">
                  {sleeperLeague.name}
                </div>
                <div className="text-xs text-muted-foreground">Season {sleeperLeague.season}</div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Badge>Sleeper</Badge>
                {convertedLeague ? (
                  <Link
                    href={`/leagues/${convertedLeague.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    View converted league →
                  </Link>
                ) : (
                  <ConvertLeagueButton />
                )}
              </div>
            </div>
          </div>
        )}

        {memberships.length === 0 && !sleeperLeague ? (
          <EmptyStateCard
            title="No leagues yet"
            description="Start a new league or join one with an invite code."
          />
        ) : memberships.length > 0 ? (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {memberships.map((m) => (
              <Link
                key={m.leagueId}
                href={`/leagues/${m.leagueId}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {m.league.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.role === "COMMISSIONER" ? "Commissioner" : "Member"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">
                    {LEAGUE_TYPE_LABELS[m.league.leagueType] ?? m.league.leagueType}
                  </Badge>
                  <Badge variant="outline">
                    {STATUS_LABELS[m.league.status] ?? m.league.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        <h2 className="mt-6 mb-2 font-heading text-xs uppercase tracking-wide text-muted-foreground">
          Practice
        </h2>
        <Link href="/mock-draft" className="block">
          <Card className="border-border bg-card transition-colors hover:bg-secondary">
            <CardHeader>
              <CardTitle className="font-heading text-base uppercase tracking-wide text-foreground">
                Mock Draft
              </CardTitle>
              <CardDescription>Practice draft strategy against bots</CardDescription>
              <CardAction>
                <span className={buttonVariants({ variant: "outline", size: "sm" })}>Play</span>
              </CardAction>
            </CardHeader>
          </Card>
        </Link>
    </div>
  );
}
