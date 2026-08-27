import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getNflState } from "@/lib/sleeper";
import { getNflverseRosters, getNflverseWeeklyStats } from "@/lib/nflverse";
import { MockDraftClient, type DraftablePlayer } from "./mock-draft-client";

const DRAFT_ELIGIBLE_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

export default async function MockDraftPage() {
  await requireUser();

  const state = await getNflState();
  const [nflverseRosters, nflverseWeeklyStats] = await Promise.all([
    getNflverseRosters(state.season),
    getNflverseWeeklyStats(state.previous_season),
  ]);

  function seasonTotalFor(gsisId: string): number | null {
    const lines = nflverseWeeklyStats.get(gsisId);
    if (!lines || lines.length === 0) return null;
    return lines.reduce((sum, l) => sum + l.pointsPpr, 0);
  }

  const players: DraftablePlayer[] = Array.from(nflverseRosters.byGsisId.values())
    .filter((p) => {
      if (!p.position || !DRAFT_ELIGIBLE_POSITIONS.has(p.position)) return false;
      return !!p.team;
    })
    .map((p) => ({
      nflverseId: p.gsisId,
      headshotUrl: p.headshotUrl,
      name: p.fullName,
      team: p.team,
      position: p.position!,
      lastSeasonPoints: seasonTotalFor(p.gsisId),
    }))
    .sort((a, b) => (b.lastSeasonPoints ?? 0) - (a.lastSeasonPoints ?? 0));

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </Link>
      <h1 className="mt-4 mb-4 font-heading text-2xl uppercase tracking-wide text-foreground">
        Mock Draft
      </h1>
      <MockDraftClient players={players} />
    </div>
  );
}
