"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn, shortSlot } from "@/lib/utils";
import { setWeeklyStarter } from "@/app/actions/fantasy-lineup";

export type BenchOption = {
  pickId: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
  headshotUrl: string | null;
  projectedPoints: number;
};

export type StarterRow = {
  pickId: string;
  slot: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
  headshotUrl: string | null;
  scheduleLabel: string;
  projectedPoints: number;
  points: number | null; // null = no real stats yet, shown as "-"
  locked: boolean;
  // Eligible bench replacements — always empty when not the owner, the week is locked, or
  // already final (imported from Sleeper), which is what actually gates the tap-to-swap UI.
  benchOptions: BenchOption[];
};

export function StartersView({
  leagueId,
  week,
  starters,
  isImportedWeek,
}: {
  leagueId: string;
  week: number;
  starters: StarterRow[];
  isImportedWeek: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openPickId, setOpenPickId] = useState<string | null>(null);

  const openRow = starters.find((s) => s.pickId === openPickId) ?? null;
  const benchOptions = openRow?.benchOptions ?? [];

  function handleSwap(benchPickId: string) {
    if (!openRow) return;
    startTransition(async () => {
      const result = await setWeeklyStarter(leagueId, week, openRow.pickId, benchPickId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOpenPickId(null);
      toast.success("Lineup updated.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
        Starters — Week {week}
        {isImportedWeek && (
          <span className="ml-2 normal-case text-muted-foreground/70">
            (final, imported from Sleeper)
          </span>
        )}
      </h3>
      <div className="flex flex-col divide-y divide-border/60">
        {starters.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {isImportedWeek
              ? "This week's score is final, imported directly from Sleeper — a per-player breakdown isn't available."
              : "No starters set for this week."}
          </p>
        ) : (
          starters.map((row) => {
            const canSwap = row.benchOptions.length > 0;
            return (
              <div key={row.pickId} className="flex items-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  disabled={!canSwap || isPending}
                  onClick={() => setOpenPickId(row.pickId)}
                  className={cn(
                    "w-14 shrink-0 rounded-full border px-2 py-1 text-center font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors",
                    canSwap
                      ? "border-positive/40 text-positive hover:bg-positive/10"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {shortSlot(row.slot)}
                </button>
                <PlayerAvatar
                  headshotUrl={row.headshotUrl}
                  name={row.playerName}
                  className="h-9 w-9"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {row.playerName}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.playerPosition ?? "UNK"} · {row.scheduleLabel}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm text-foreground">
                    {row.points !== null ? row.points.toFixed(1) : "-"}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    Proj {row.projectedPoints.toFixed(1)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={openRow !== null} onOpenChange={(open) => !open && setOpenPickId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Swap {openRow ? shortSlot(openRow.slot) : ""}</DialogTitle>
          </DialogHeader>
          <div className="-mx-4 flex flex-col divide-y divide-border/60">
            {benchOptions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No eligible bench players.
              </p>
            ) : (
              benchOptions.map((b) => (
                <button
                  key={b.pickId}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSwap(b.pickId)}
                  className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  <PlayerAvatar
                    headshotUrl={b.headshotUrl}
                    name={b.playerName}
                    className="h-9 w-9"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {b.playerName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {b.playerPosition ?? "UNK"} · {b.playerTeam ?? "FA"}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-xs text-muted-foreground">
                    Proj {b.projectedPoints.toFixed(1)}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
