"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { setRosterSlot } from "@/app/actions/fantasy-roster";

export type RosterSlotRow = {
  pickId: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
  headshotUrl: string | null;
};

// Renders a member's Taxi Squad or IR list — used twice in My Team, once per slot. Hidden
// entirely when the league doesn't use that slot at all (capacity 0 and nobody on it), so a
// league that never configured Taxi/IR sees no extra clutter.
export function RosterSlotSection({
  leagueId,
  title,
  rows,
  capacity,
  canEdit,
}: {
  leagueId: string;
  title: string;
  rows: RosterSlotRow[];
  capacity: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (rows.length === 0 && capacity === 0) return null;

  function handleActivate(pickId: string) {
    startTransition(async () => {
      const result = await setRosterSlot(leagueId, pickId, "ACTIVE");
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Moved to your active roster.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
          {title}{" "}
          <span className="normal-case text-muted-foreground/70">
            ({rows.length}/{capacity})
          </span>
        </h3>
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No players here.</p>
        ) : (
          rows.map((row) => (
            <div key={row.pickId} className="flex items-center gap-3 px-4 py-2.5">
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
                  {row.playerPosition ?? "UNK"} · {row.playerTeam ?? "FA"}
                </div>
              </div>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleActivate(row.pickId)}
                  className="shrink-0"
                >
                  Move to Active
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
