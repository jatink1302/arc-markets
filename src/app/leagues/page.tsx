import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyStateCard } from "@/components/empty-state-card";

const STATUS_LABELS: Record<string, string> = {
  FORMING: "Forming",
  DRAFTING: "Drafting",
  ACTIVE: "Active",
};

export default async function LeaguesPage() {
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

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 p-4">
      <div className="w-full max-w-2xl">
        <Link
          href="/matchup"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>

        <div className="mt-4 mb-4 flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
            My Leagues
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
            <Link
              href="/matchup"
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-secondary"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {sleeperLeague.name}
                </div>
                <div className="text-xs text-muted-foreground">Season {sleeperLeague.season}</div>
              </div>
              <Badge className="shrink-0">Sleeper</Badge>
            </Link>
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
                <Badge variant="outline" className="shrink-0">
                  {STATUS_LABELS[m.league.status] ?? m.league.status}
                </Badge>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
