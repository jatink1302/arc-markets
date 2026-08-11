import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NoLeagueCard } from "@/components/no-league-card";
import { MarketList } from "@/components/market/market-list";
import { TickerHeader } from "@/components/market/ticker-header";
import { TrendingCards, type TrendingCardData } from "@/components/market/trending-cards";
import type { MarketPlayer } from "@/components/market/player-row";

type MarketPlayerWithActivity = MarketPlayer & { tradesToday: number; volumeToday: number };

export default async function MarketsPage() {
  const authUser = await requireUser();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: authUser.id },
    include: { activeLeague: true },
  });

  if (!user.activeLeagueId || !user.activeLeague) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
          Markets
        </h1>
        <NoLeagueCard what="the player market" />
      </div>
    );
  }
  const leagueId = user.activeLeagueId;
  const activeLeague = user.activeLeague;

  const [players, trades] = await Promise.all([
    prisma.player.findMany({
      where: { leagueId },
      include: { roster: true },
      orderBy: { currentPrice: "desc" },
    }),
    prisma.trade.findMany({
      where: { player: { leagueId } },
      orderBy: { createdAt: "asc" },
      select: { playerId: true, price: true, totalAmount: true, createdAt: true },
    }),
  ]);

  const tradesByPlayer = new Map<
    string,
    { price: number; totalAmount: number; createdAt: Date }[]
  >();
  for (const t of trades) {
    const list = tradesByPlayer.get(t.playerId) ?? [];
    list.push({ price: Number(t.price), totalAmount: Number(t.totalAmount), createdAt: t.createdAt });
    tradesByPlayer.set(t.playerId, list);
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const marketPlayers: MarketPlayerWithActivity[] = players.map((p) => {
    const history = tradesByPlayer.get(p.id) ?? [];
    const currentPrice = Number(p.currentPrice);
    const todaysHistory = history.filter((t) => t.createdAt >= startOfToday);
    const openPrice = todaysHistory.length > 0 ? todaysHistory[0].price : currentPrice;
    const pctChangeToday = openPrice > 0 ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
    const todaysVolume = todaysHistory.reduce((sum, t) => sum + t.totalAmount, 0);

    return {
      id: p.id,
      headshotUrl: p.headshotUrl,
      fullName: p.fullName,
      team: p.team,
      position: p.position,
      currentPrice,
      ownerName: p.roster?.displayName ?? null,
      pctChangeToday,
      sparkline: history.slice(-10).map((t) => t.price),
      tradesToday: todaysHistory.length,
      volumeToday: todaysVolume,
    };
  });

  const tradesToday = marketPlayers.reduce((sum, p) => sum + p.tradesToday, 0);
  const volumeToday = marketPlayers.reduce((sum, p) => sum + p.volumeToday, 0);

  const withTodaysActivity = marketPlayers.filter((p) => p.tradesToday > 0);

  const trendingUp = withTodaysActivity.length
    ? withTodaysActivity.reduce((a, b) => (b.pctChangeToday > a.pctChangeToday ? b : a))
    : null;
  const biggestDrop = withTodaysActivity.length
    ? withTodaysActivity.reduce((a, b) => (b.pctChangeToday < a.pctChangeToday ? b : a))
    : null;
  const mostActive = withTodaysActivity.length
    ? withTodaysActivity.reduce((a, b) => (b.tradesToday > a.tradesToday ? b : a))
    : null;

  function toCard(
    label: string,
    p: MarketPlayerWithActivity | null,
    statFn: (p: MarketPlayerWithActivity) => string,
  ): TrendingCardData {
    if (!p) return null;
    return {
      label,
      playerId: p.id,
      headshotUrl: p.headshotUrl,
      position: p.position,
      name: p.fullName,
      stat: statFn(p),
      positive: p.pctChangeToday >= 0,
      sparkline: p.sparkline,
    };
  }

  const trendingCards: TrendingCardData[] = [
    toCard("Trending Up", trendingUp, (p) => `+${p.pctChangeToday.toFixed(1)}%`),
    toCard("Biggest Drop", biggestDrop, (p) => `${p.pctChangeToday.toFixed(1)}%`),
    toCard("Most Active", mostActive, (p) => `${p.tradesToday} trades`),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
          Markets
        </h1>
        <p className="text-sm text-muted-foreground">
          {players.length} players trading in {activeLeague.name}.
        </p>
      </div>
      <TickerHeader
        tradesToday={tradesToday}
        volumeToday={volumeToday}
        season={activeLeague.season}
      />
      <TrendingCards cards={trendingCards} />
      <MarketList players={marketPlayers} />
    </div>
  );
}
