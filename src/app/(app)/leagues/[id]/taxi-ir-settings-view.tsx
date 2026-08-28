"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateTaxiIrCapacity } from "@/app/actions/fantasy-roster";

// Commissioner-only, ACTIVE-league-only capacity control — a narrow, purpose-built
// exception to the general "settings lock once the draft starts" rule (see
// updateLeagueSettings in actions/fantasy-league.ts), safe specifically because Taxi/IR
// capacity can never retroactively change any already-decided week's lineup math.
export function TaxiIrSettingsView({
  leagueId,
  taxi,
  ir,
}: {
  leagueId: string;
  taxi: number;
  ir: number;
}) {
  const router = useRouter();
  const [taxiValue, setTaxiValue] = useState(String(taxi));
  const [irValue, setIrValue] = useState(String(ir));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const taxiNum = Number(taxiValue);
    const irNum = Number(irValue);
    startTransition(async () => {
      const result = await updateTaxiIrCapacity(leagueId, taxiNum, irNum);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Updated Taxi Squad and IR limits.");
      router.refresh();
    });
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="font-heading text-sm uppercase tracking-wide text-foreground">
          Taxi Squad &amp; IR
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Players on Taxi Squad or IR don&apos;t count against a team&apos;s active roster cap.
          A limit can&apos;t be lowered below what a team currently has stashed there.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="taxi-capacity">Taxi Squad slots per team</Label>
          <Input
            id="taxi-capacity"
            type="number"
            min={0}
            max={20}
            value={taxiValue}
            onChange={(e) => setTaxiValue(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ir-capacity">IR slots per team</Label>
          <Input
            id="ir-capacity"
            type="number"
            min={0}
            max={20}
            value={irValue}
            onChange={(e) => setIrValue(e.target.value)}
          />
        </div>
        <Button type="button" disabled={isPending} onClick={handleSave} className="self-start">
          {isPending ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
