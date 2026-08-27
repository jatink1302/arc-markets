import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";

export type PositionRowData = {
  id: string;
  playerId: string;
  name: string;
  team: string | null;
  position: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
};

export function PositionRow({ row }: { row: PositionRowData }) {
  const positive = row.unrealizedPl >= 0;
  return (
    <Link
      href={`/markets/${row.playerId}`}
      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
          {row.position}
        </Badge>
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{row.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.quantity.toFixed(2)} contracts · ${formatMoney(row.currentPrice)} avg
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right font-mono text-sm">
        <div className="text-foreground">${formatMoney(row.marketValue)}</div>
        <div className={positive ? "text-positive" : "text-negative"}>
          {positive ? "+" : ""}
          ${formatMoney(row.unrealizedPl)}
        </div>
      </div>
    </Link>
  );
}
