"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setRosterSlot } from "@/app/actions/fantasy-roster";

const SLOT_LABEL: Record<"ACTIVE" | "TAXI" | "IR", string> = {
  ACTIVE: "Active",
  TAXI: "Taxi",
  IR: "IR",
};

// Compact per-pick roster-slot control for the Rosters tab — only rendered for your own
// picks (see league-rosters-view.tsx), and only offers Taxi/IR when the league actually
// uses them (capacity > 0), so a league that never configured either sees a plain "Active".
export function RosterSlotSelect({
  leagueId,
  pickId,
  rosterSlot,
  taxiEnabled,
  irEnabled,
}: {
  leagueId: string;
  pickId: string;
  rosterSlot: "ACTIVE" | "TAXI" | "IR";
  taxiEnabled: boolean;
  irEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!taxiEnabled && !irEnabled) return null;

  function handleChange(value: unknown) {
    const target = value as "ACTIVE" | "TAXI" | "IR";
    if (target === rosterSlot) return;
    startTransition(async () => {
      const result = await setRosterSlot(leagueId, pickId, target);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Moved to ${SLOT_LABEL[target]}.`);
      router.refresh();
    });
  }

  return (
    <Select value={rosterSlot} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="h-6 shrink-0 px-2 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ACTIVE">Active</SelectItem>
        {taxiEnabled && <SelectItem value="TAXI">Taxi</SelectItem>}
        {irEnabled && <SelectItem value="IR">IR</SelectItem>}
      </SelectContent>
    </Select>
  );
}
