import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { MiniSparkline } from "@/components/mini-sparkline";
import { cn } from "@/lib/utils";

export type TrendingCardData = {
  label: string;
  playerId: string;
  headshotUrl: string | null;
  position: string;
  name: string;
  stat: string;
  positive: boolean;
  sparkline: number[];
} | null; // null when no player currently qualifies (e.g. no trades yet today)

export function TrendingCards({ cards }: { cards: TrendingCardData[] }) {
  const qualifying = cards.filter((c): c is NonNullable<TrendingCardData> => c !== null);
  if (qualifying.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {qualifying.map((card) => (
        <Link
          key={card.label}
          href={`/markets/${card.playerId}`}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lg hover:shadow-primary/10"
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {card.label}
          </span>
          <div className="flex items-center gap-2">
            <PlayerAvatar headshotUrl={card.headshotUrl} name={card.name} className="h-8 w-8" />
            <span className="truncate text-sm font-medium text-foreground">{card.name}</span>
          </div>
          <span
            className={cn(
              "font-mono text-sm font-semibold",
              card.positive ? "text-positive" : "text-negative",
            )}
          >
            {card.stat}
          </span>
          <MiniSparkline prices={card.sparkline} width={120} height={28} />
        </Link>
      ))}
    </div>
  );
}
