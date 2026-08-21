"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { respondToTrade, cancelTrade } from "@/app/actions/fantasy-trade";
import { ProposeTradeCard, type TradePickOption } from "./propose-trade-card";

export type TradeItemData = { playerName: string; playerPosition: string | null; fromMemberName: string };

export type TradeRowData = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COUNTERED";
  proposerName: string;
  recipientName: string;
  items: TradeItemData[];
  isIncoming: boolean;
  isOutgoing: boolean;
  isCounterOffer: boolean;
  myPicks: TradePickOption[];
  counterpartyPicks: TradePickOption[];
};

function TradeItemsList({ items }: { items: TradeItemData[] }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-secondary/30 p-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate text-foreground">{item.playerName}</span>
          <span className="max-w-[40%] shrink-0 truncate text-muted-foreground">
            {item.fromMemberName}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TradesView({
  pending,
  history,
}: {
  pending: TradeRowData[];
  history: TradeRowData[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function respond(tradeId: string, accept: boolean) {
    startTransition(async () => {
      const result = await respondToTrade(tradeId, accept);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(accept ? "Trade accepted." : "Trade rejected.");
      router.refresh();
    });
  }

  function cancel(tradeId: string) {
    startTransition(async () => {
      const result = await cancelTrade(tradeId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Trade cancelled.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
          Pending
        </h3>
        <div className="flex flex-col divide-y divide-border/60">
          {pending.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No pending trades.</p>
          ) : (
            pending.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 px-4 py-3">
                {t.isCounterOffer && (
                  <span className="text-xs text-muted-foreground">↩ Countered offer</span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {t.proposerName} ↔ {t.recipientName}
                  </span>
                  {t.isIncoming && (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" disabled={isPending} onClick={() => respond(t.id, true)}>
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => respond(t.id, false)}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {t.isOutgoing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => cancel(t.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
                <TradeItemsList items={t.items} />
                {t.isIncoming && (
                  <ProposeTradeCard
                    mode="counter"
                    originalTradeId={t.id}
                    myPicks={t.myPicks}
                    theirPicks={t.counterpartyPicks}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
          History
        </h3>
        <div className="flex flex-col divide-y divide-border/60">
          {history.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No resolved trades yet.</p>
          ) : (
            history.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 px-4 py-3">
                {t.isCounterOffer && (
                  <span className="text-xs text-muted-foreground">↩ Countered offer</span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {t.proposerName} ↔ {t.recipientName}
                  </span>
                  <Badge
                    variant={t.status === "ACCEPTED" ? "secondary" : "outline"}
                    className="shrink-0"
                  >
                    {t.status}
                  </Badge>
                </div>
                <TradeItemsList items={t.items} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
