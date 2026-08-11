import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/ledger";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { PriceHistory } from "@/components/market/price-history";
import { WeeklyPointsBars, type WeeklyPoints } from "@/components/market/weekly-points-bars";
import { TradePanel } from "@/components/trade/trade-panel";

// Real weekly stats live in our own PlayerWeeklyStat table (seeded from nflverse at import
// time), not fetched live — stats update roughly weekly, not per-request, so owning them here
// is more honest than faking a live fetch.
async function getWeeklyPoints(playerId: string, season: string): Promise<WeeklyPoints[]> {
  const rows = await prisma.playerWeeklyStat.findMany({
    where: { playerId, season },
    orderBy: { week: "asc" },
  });
  return rows.map((r) => ({ week: r.week, points: Number(r.pointsPpr) }));
}

export default async function PlayerDetailPage({
  params,
}: PageProps<"/markets/[playerId]">) {
  const { playerId } = await params;
  const authUser = await requireUser();

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { roster: true, league: true },
  });
  if (!player) notFound();

  const currentSeason = player.league.season;
  const previousSeason = String(Number(currentSeason) - 1);

  const [recentTrades, position, balance, currentSeasonGames, previousSeasonGames] =
    await Promise.all([
      prisma.trade.findMany({
        where: { playerId },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { email: true } } },
      }),
      prisma.position.findUnique({
        where: { userId_playerId: { userId: authUser.id, playerId } },
      }),
      getBalance(authUser.id),
      getWeeklyPoints(playerId, currentSeason),
      getWeeklyPoints(playerId, previousSeason),
    ]);

  const lastFiveGames = currentSeasonGames.slice(-5);
  const previousSeasonTotal = previousSeasonGames.reduce((sum, g) => sum + g.points, 0);

  const currentPrice = Number(player.currentPrice);
  const heldQuantity = position ? Number(position.quantity) : 0;
  const costBasis = position ? Number(position.costBasis) : 0;
  const unrealizedPl = heldQuantity > 0 ? heldQuantity * currentPrice - costBasis : 0;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-4">
          <PlayerAvatar headshotUrl={player.headshotUrl} name={player.fullName} className="h-16 w-16" />
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {player.position}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {player.team ?? "Free agent"}
                {player.roster ? ` · ${player.roster.displayName}` : ""}
              </span>
            </div>
            <h1 className="font-heading text-3xl uppercase tracking-wide text-foreground">
              {player.fullName}
            </h1>
            <div className="mt-1 font-mono text-2xl font-semibold text-foreground">
              ${currentPrice.toFixed(2)}
            </div>
          </div>
        </div>

        <PriceHistory
          trades={recentTrades.map((t) => ({
            id: t.id,
            price: Number(t.price),
            createdAt: t.createdAt.toISOString(),
            side: t.side,
            quantity: Number(t.quantity),
          }))}
        />

        <WeeklyPointsBars
          title="Last 5 games"
          games={lastFiveGames}
          emptyTitle="No games played yet this season"
          emptyDescription="Weekly fantasy points show up here once the NFL season starts."
        />

        <WeeklyPointsBars
          title={`${previousSeason} season`}
          games={previousSeasonGames}
          emptyTitle={`No ${previousSeason} data`}
          emptyDescription="This player may not have played that season."
          summary={
            previousSeasonGames.length > 0
              ? `${previousSeasonTotal.toFixed(1)} pts · ${previousSeasonGames.length} games`
              : undefined
          }
        />

        {heldQuantity > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
              Your position
            </h2>
            <div className="mt-2 flex gap-6 font-mono text-sm">
              <div>
                <div className="text-muted-foreground">Contracts</div>
                <div className="text-foreground">{heldQuantity.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Cost basis</div>
                <div className="text-foreground">${costBasis.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Unrealized P/L</div>
                <div className={unrealizedPl >= 0 ? "text-positive" : "text-negative"}>
                  {unrealizedPl >= 0 ? "+" : ""}
                  ${unrealizedPl.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="lg:w-80">
        <TradePanel
          playerId={player.id}
          curve={{
            basePrice: Number(player.basePrice),
            slope: Number(player.slope),
            supply: player.supply,
          }}
          balance={balance}
          heldQuantity={heldQuantity}
        />
      </div>
    </div>
  );
}
