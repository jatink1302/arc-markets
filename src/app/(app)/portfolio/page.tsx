import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalance, getPositions } from "@/lib/ledger";
import { formatMoney } from "@/lib/utils";
import { NoLeagueCard } from "@/components/no-league-card";
import { PositionRow } from "@/components/portfolio/position-row";

export default async function PortfolioPage() {
  const authUser = await requireUser();

  const [user, balance, positions] = await Promise.all([
    prisma.user.findUnique({ where: { id: authUser.id }, select: { activeLeagueId: true } }),
    getBalance(authUser.id),
    getPositions(authUser.id),
  ]);

  const rows = positions.map((p) => {
    const quantity = Number(p.quantity);
    const costBasis = Number(p.costBasis);
    const currentPrice = Number(p.player.currentPrice);
    const marketValue = quantity * currentPrice;
    return {
      id: p.id,
      playerId: p.playerId,
      name: p.player.fullName,
      team: p.player.team,
      position: p.player.position,
      quantity,
      costBasis,
      currentPrice,
      marketValue,
      unrealizedPl: marketValue - costBasis,
    };
  });

  const totalMarketValue = rows.reduce((sum, r) => sum + r.marketValue, 0);
  const totalUnrealizedPl = rows.reduce((sum, r) => sum + r.unrealizedPl, 0);
  const netWorth = balance + totalMarketValue;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/matchup?tab=team"
          className="mb-2 inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Team
        </Link>
        <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
          Portfolio
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Net worth" value={`$${formatMoney(netWorth)}`} />
        <Stat label="Cash balance" value={`$${formatMoney(balance)}`} />
        <Stat label="Positions value" value={`$${formatMoney(totalMarketValue)}`} />
        <Stat
          label="Unrealized P/L"
          value={`${totalUnrealizedPl >= 0 ? "+" : ""}$${formatMoney(totalUnrealizedPl)}`}
          tone={totalUnrealizedPl >= 0 ? "positive" : "negative"}
        />
      </div>

      {rows.length === 0 && !user?.activeLeagueId ? (
        <NoLeagueCard what="a market to trade in" />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
          {rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No open positions yet — head to the Markets tab to place your first trade.
            </p>
          ) : (
            rows.map((row) => <PositionRow key={row.id} row={row} />)
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          "font-mono text-lg font-semibold " +
          (tone === "positive"
            ? "text-positive"
            : tone === "negative"
              ? "text-negative"
              : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}
