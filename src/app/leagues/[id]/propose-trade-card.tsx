"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { proposeTrade, counterTrade } from "@/app/actions/fantasy-trade";

export type TradePickOption = { id: string; playerName: string; playerPosition: string | null };

type ProposeTradeCardProps =
  | {
      mode: "propose";
      leagueId: string;
      theirMemberId: string;
      myPicks: TradePickOption[];
      theirPicks: TradePickOption[];
    }
  | {
      mode: "counter";
      originalTradeId: string;
      myPicks: TradePickOption[];
      theirPicks: TradePickOption[];
    };

export function ProposeTradeCard(props: ProposeTradeCardProps) {
  const { myPicks, theirPicks } = props;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [offered, setOffered] = useState<Set<string>>(new Set());
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const offeredIds = Array.from(offered);
      const requestedIds = Array.from(requested);
      const result =
        props.mode === "propose"
          ? await proposeTrade(props.leagueId, props.theirMemberId, offeredIds, requestedIds)
          : await counterTrade(props.originalTradeId, offeredIds, requestedIds);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(props.mode === "propose" ? "Trade proposed." : "Counter-offer sent.");
      setOpen(false);
      setOffered(new Set());
      setRequested(new Set());
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {props.mode === "propose" ? "Propose trade" : "Counter"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/40 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">You give</p>
          <div className="flex flex-col gap-1">
            {myPicks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No players.</p>
            ) : (
              myPicks.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={offered.has(p.id)}
                    onChange={() => toggle(offered, setOffered, p.id)}
                  />
                  {p.playerName}
                  {p.playerPosition && (
                    <span className="text-muted-foreground">· {p.playerPosition}</span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">You get</p>
          <div className="flex flex-col gap-1">
            {theirPicks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No players.</p>
            ) : (
              theirPicks.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={requested.has(p.id)}
                    onChange={() => toggle(requested, setRequested, p.id)}
                  />
                  {p.playerName}
                  {p.playerPosition && (
                    <span className="text-muted-foreground">· {p.playerPosition}</span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-negative">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={isPending || offered.size === 0 || requested.size === 0}
          onClick={submit}
        >
          {isPending
            ? "Sending…"
            : props.mode === "propose"
              ? "Send proposal"
              : "Send counter"}
        </Button>
        <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
