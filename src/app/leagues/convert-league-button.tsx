"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { previewLeagueConversion, convertSleeperLeagueToNative } from "@/app/actions/fantasy-league-conversion";

type Preview = {
  leagueName: string;
  teamCount: number;
  weeksToImport: number;
  limitations: string[];
};

export function ConvertLeagueButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [isPreviewing, startPreviewTransition] = useTransition();
  const [isConverting, startConvertTransition] = useTransition();

  function handleOpen() {
    startPreviewTransition(async () => {
      const result = await previewLeagueConversion();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (result.alreadyConverted) {
        router.push(`/leagues/${result.leagueId}`);
        return;
      }
      setPreview({
        leagueName: result.leagueName,
        teamCount: result.teamCount,
        weeksToImport: result.weeksToImport,
        limitations: result.limitations,
      });
      setOpen(true);
    });
  }

  function handleConvert() {
    startConvertTransition(async () => {
      const result = await convertSleeperLeagueToNative();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      router.push(`/leagues/${result.leagueId}`);
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" disabled={isPreviewing} onClick={handleOpen}>
        {isPreviewing ? "Loading…" : "Convert to native league"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert {preview?.leagueName}?</DialogTitle>
            <DialogDescription>
              This imports all {preview?.teamCount} real teams, rosters, and the last{" "}
              {preview?.weeksToImport}-week schedule as a native Summit league you fully
              control. Summit becomes the real league from here — nothing syncs back to
              Sleeper, and this can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>

          {preview && preview.limitations.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-md bg-secondary/50 p-3">
              <span className="text-xs font-medium text-foreground">Before you convert:</span>
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {preview.limitations.map((limitation, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="shrink-0">•</span>
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" disabled={isConverting} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={isConverting} onClick={handleConvert}>
              {isConverting ? "Converting…" : "Convert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
