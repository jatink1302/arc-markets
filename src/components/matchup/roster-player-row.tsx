import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn, formatMoney } from "@/lib/utils";

export type RosterPlayerRowData = {
  playerId: string | null; // Summit Player.id, if this Sleeper player is in our market
  sleeperPlayerId: string;
  headshotUrl: string | null;
  name: string;
  team: string | null;
  position: string;
  price: number | null;
  points: number | null;
  slot?: string | null; // lineup slot (e.g. "FLEX") — omitted when it matches position, or for bench
};

export function RosterPlayerRow({
  row,
  align = "left",
}: {
  row: RosterPlayerRowData;
  align?: "left" | "right";
}) {
  const reversed = align === "right";
  const content = (
    <div className={cn("flex items-center gap-3 px-4 py-2.5", reversed ? "flex-row-reverse justify-between" : "justify-between")}>
      <div className={cn("flex min-w-0 items-center gap-3", reversed && "flex-row-reverse")}>
        <PlayerAvatar headshotUrl={row.headshotUrl} name={row.name} className="h-9 w-9" />
        <div className={cn("min-w-0", reversed && "text-right")}>
          <div className="truncate text-sm font-medium text-foreground">{row.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.slot && row.slot !== row.position ? `${row.slot} · ` : ""}
            {row.position} · {row.team ?? "FA"}
          </div>
        </div>
      </div>
      <div className={cn("shrink-0", reversed ? "text-left" : "text-right")}>
        {row.points !== null && (
          <div className="font-mono text-sm text-foreground">{row.points.toFixed(1)}</div>
        )}
        {row.price !== null && (
          <div className="font-mono text-xs text-positive">${formatMoney(row.price)}</div>
        )}
      </div>
    </div>
  );

  if (row.playerId) {
    return (
      <Link href={`/markets/${row.playerId}`} className="block transition-colors hover:bg-secondary">
        {content}
      </Link>
    );
  }
  return content;
}
