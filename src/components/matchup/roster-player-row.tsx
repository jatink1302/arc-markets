import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatMoney } from "@/lib/utils";

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

export function RosterPlayerRow({ row }: { row: RosterPlayerRowData }) {
  const content = (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar headshotUrl={row.headshotUrl} name={row.name} className="h-9 w-9" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{row.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.slot && row.slot !== row.position ? `${row.slot} · ` : ""}
            {row.position} · {row.team ?? "FA"}
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right">
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
