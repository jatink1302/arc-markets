"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlayerAvatar } from "@/components/player-avatar";
import { cn, shortSlot } from "@/lib/utils";
import { setWeeklyStarter } from "@/app/actions/fantasy-lineup";
import { setRosterSlot } from "@/app/actions/fantasy-roster";

export type StarterOption = {
  pickId: string;
  slot: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
  headshotUrl: string | null;
  projectedPoints: number;
};

export type BenchRow = {
  pickId: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
  headshotUrl: string | null;
  scheduleLabel: string;
  projectedPoints: number;
  points: number | null; // null = no real stats yet, shown as "-"
  // Eligible starting slots this bench player could fill — always empty when not the
  // owner, this player's own game has already kicked off, or the week is final, which is
  // what actually gates the tap-to-start UI.
  starterOptions: StarterOption[];
  // Whether Taxi/IR moves are offered for this row at all — isOwner && !isImportedWeek,
  // same as starterOptions' gate but NOT locked-dependent (a roster-slot move has no
  // kickoff lock, unlike a lineup swap — see roster-slot.ts).
  canMoveSlot: boolean;
};

export function BenchView({
  leagueId,
  week,
  bench,
  taxiEnabled,
  irEnabled,
}: {
  leagueId: string;
  week: number;
  bench: BenchRow[];
  taxiEnabled: boolean;
  irEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openPickId, setOpenPickId] = useState<string | null>(null);

  const openRow = bench.find((b) => b.pickId === openPickId) ?? null;
  const starterOptions = openRow?.starterOptions ?? [];
  const showMoveOptions = openRow?.canMoveSlot && (taxiEnabled || irEnabled);

  function handleSwap(starterPickId: string) {
    if (!openRow) return;
    startTransition(async () => {
      const result = await setWeeklyStarter(leagueId, week, starterPickId, openRow.pickId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOpenPickId(null);
      toast.success("Lineup updated.");
      router.refresh();
    });
  }

  function handleMoveSlot(targetSlot: "TAXI" | "IR") {
    if (!openRow) return;
    startTransition(async () => {
      const result = await setRosterSlot(leagueId, openRow.pickId, targetSlot);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOpenPickId(null);
      toast.success(`Moved to ${targetSlot === "TAXI" ? "Taxi Squad" : "IR"}.`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
          Bench
        </h3>
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {bench.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No bench players.</p>
        ) : (
          bench.map((row) => {
            const canSwap =
              row.starterOptions.length > 0 ||
              (row.canMoveSlot && (taxiEnabled || irEnabled));
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
                  {row.playerPosition ?? "UNK"}
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
            <DialogTitle>Move {openRow?.playerName ?? ""}</DialogTitle>
          </DialogHeader>
          <div className="-mx-4 flex flex-col divide-y divide-border/60">
            {starterOptions.length === 0 && !showMoveOptions ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No moves available.</p>
            ) : (
              starterOptions.map((s) => (
                <button
                  key={s.pickId}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSwap(s.pickId)}
                  className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-secondary disabled:opacity-60"
                >
                  <PlayerAvatar
                    headshotUrl={s.headshotUrl}
                    name={s.playerName}
                    className="h-9 w-9"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">
                      {s.playerName}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {shortSlot(s.slot)} · {s.playerPosition ?? "UNK"}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-xs text-muted-foreground">
                    Proj {s.projectedPoints.toFixed(1)}
                  </div>
                </button>
              ))
            )}
            {showMoveOptions && taxiEnabled && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleMoveSlot("TAXI")}
                className="px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
              >
                Move to Taxi Squad
              </button>
            )}
            {showMoveOptions && irEnabled && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleMoveSlot("IR")}
                className="px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
              >
                Move to IR
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
