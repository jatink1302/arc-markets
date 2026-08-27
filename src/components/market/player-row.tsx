import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { MiniSparkline } from "@/components/mini-sparkline";
import { cn, formatMoney } from "@/lib/utils";

export type MarketPlayer = {
  id: string;
  headshotUrl: string | null;
  fullName: string;
  team: string | null;
  position: string;
  currentPrice: number;
  ownerName: string | null;
  pctChangeToday: number;
  sparkline: number[];
};

export function PlayerRow({ player }: { player: MarketPlayer }) {
  const positive = player.pctChangeToday >= 0;
  return (
    <Link
      href={`/markets/${player.id}`}
      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary"
    >
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar headshotUrl={player.headshotUrl} name={player.fullName} className="h-10 w-10" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-foreground">{player.fullName}</span>
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
              {player.position}
            </Badge>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {player.team ?? "FA"}
            {player.ownerName ? ` · ${player.ownerName}` : ""}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <MiniSparkline prices={player.sparkline} />
        <div className="text-right">
          <div className="font-mono text-sm font-semibold text-foreground">
            ${formatMoney(player.currentPrice)}
          </div>
          <div className={cn("font-mono text-xs", positive ? "text-positive" : "text-negative")}>
            {player.sparkline.length < 2
              ? "—"
              : `${positive ? "+" : ""}${player.pctChangeToday.toFixed(1)}%`}
          </div>
        </div>
      </div>
    </Link>
  );
}
