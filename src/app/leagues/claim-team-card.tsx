"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { claimFantasyTeam } from "@/app/actions/fantasy-league-conversion";

export function ClaimTeamCard({
  memberId,
  teamName,
  leagueName,
}: {
  memberId: string;
  teamName: string;
  leagueName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClaim() {
    startTransition(async () => {
      const result = await claimFantasyTeam(memberId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.push(`/leagues/${result.leagueId}`);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-accent px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">
          Your team &ldquo;{teamName}&rdquo; in {leagueName} is waiting for you
        </div>
        <div className="text-xs text-muted-foreground">Claim it to trade, drop, and manage it here.</div>
      </div>
      <Button size="sm" disabled={isPending} onClick={handleClaim} className="shrink-0">
        {isPending ? "Claiming…" : "Claim"}
      </Button>
    </div>
  );
}
