"use client";

import { useState } from "react";
import { ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RosterSettings } from "@/lib/fantasy-defaults";

export type MyPickRow = {
  id: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
  round: number | null;
  pickNo: number;
};

// Real drafted-player positions only — FLEX/SUPERFLEX/BENCH in RosterSettings are slot
// categories a pick can fill, not positions a pick ever reports, so they're not counted here.
const KNOWN_POSITIONS = ["QB", "RB", "WR", "TE", "DEF", "K"] as const;

export function MyPicksSheet({
  picks,
  rosterSettings,
}: {
  picks: MyPickRow[];
  rosterSettings: RosterSettings;
}) {
  const [open, setOpen] = useState(false);

  const byPosition = new Map<string, MyPickRow[]>();
  for (const pick of picks) {
    const pos = pick.playerPosition ?? "OTHER";
    const list = byPosition.get(pos) ?? [];
    list.push(pick);
    byPosition.set(pos, list);
  }
  for (const list of byPosition.values()) list.sort((a, b) => a.pickNo - b.pickNo);

  const otherPositions = Array.from(byPosition.keys()).filter(
    (p) => !(KNOWN_POSITIONS as readonly string[]).includes(p),
  );
  const orderedPositions = [...KNOWN_POSITIONS.filter((p) => byPosition.has(p)), ...otherPositions];

  function countFor(pos: string): number {
    return byPosition.get(pos)?.length ?? 0;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed inset-x-0 bottom-20 z-40 mx-auto flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-foreground transition-colors hover:text-primary md:bottom-6",
          "border border-white/15 bg-card/30 backdrop-blur-2xl backdrop-saturate-200",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18),0_8px_24px_-4px_rgba(0,0,0,0.45)]",
        )}
      >
        <ChevronUp className="h-3.5 w-3.5" />
        My Team
        <span className="rounded-full bg-primary px-1.5 py-0.5 font-mono text-[0.65rem] text-primary-foreground">
          {picks.length}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "relative max-h-[75vh] overflow-y-auto rounded-t-[28px] border-t border-white/15 bg-card/55",
              "backdrop-blur-2xl backdrop-saturate-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]",
            )}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-card/70 px-4 py-3 backdrop-blur-2xl">
              <h3 className="font-heading text-sm uppercase tracking-wide text-foreground">
                My Team ({picks.length})
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-3">
              {KNOWN_POSITIONS.map((pos) => {
                const have = countFor(pos);
                const need = rosterSettings[pos];
                const met = need > 0 && have >= need;
                return (
                  <span
                    key={pos}
                    className={cn(
                      "rounded-full border px-2 py-1 font-mono text-[0.65rem]",
                      met ? "border-positive/40 text-positive" : "border-border text-muted-foreground",
                    )}
                  >
                    {pos} {have}/{need}
                  </span>
                );
              })}
            </div>

            {picks.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No picks yet.</p>
            ) : (
              orderedPositions.map((pos) => (
                <div key={pos} className="border-b border-border/60 last:border-b-0">
                  <div className="px-4 pt-3 pb-1 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    {pos}
                  </div>
                  <div className="flex flex-col divide-y divide-border/60">
                    {byPosition.get(pos)!.map((pick) => (
                      <div key={pick.id} className="flex items-center justify-between gap-3 px-4 py-2">
                        <span className="truncate text-sm text-foreground">{pick.playerName}</span>
                        <div className="flex shrink-0 items-center gap-2 font-mono text-xs text-muted-foreground">
                          <span>{pick.playerTeam ?? "FA"}</span>
                          {pick.round != null && <span>R{pick.round}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
