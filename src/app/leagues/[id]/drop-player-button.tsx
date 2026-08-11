"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dropPlayer } from "@/app/actions/fantasy-free-agency";

export function DropPlayerButton({
  leagueId,
  pickId,
  playerName,
}: {
  leagueId: string;
  pickId: string;
  playerName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDrop() {
    startTransition(async () => {
      const result = await dropPlayer(leagueId, pickId);
      if (!result.success) {
        toast.error(result.error);
        setConfirming(false);
        return;
      }
      toast.success(`Dropped ${playerName}.`);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setConfirming(true)}
        className="h-6 shrink-0 px-2 text-xs"
      >
        Drop
      </Button>
    );
  }

  return (
    <div className="flex shrink-0 gap-1">
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={handleDrop}
        className="h-6 px-2 text-xs"
      >
        {isPending ? "…" : "Confirm"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => setConfirming(false)}
        className="h-6 px-2 text-xs"
      >
        Cancel
      </Button>
    </div>
  );
}
