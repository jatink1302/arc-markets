"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AutoRefresh } from "@/components/auto-refresh";
import {
  updateLeagueSettings,
  startDraft,
} from "@/app/actions/fantasy-league";
import {
  ROSTER_SLOT_LABELS,
  SCORING_FIELD_LABELS,
  MIN_LEAGUE_MEMBERS,
  MAX_LEAGUE_MEMBERS,
  totalRosterSlots,
  type RosterSettings,
  type ScoringSettings,
} from "@/lib/fantasy-defaults";

type Member = {
  id: string;
  userId: string | null;
  role: "COMMISSIONER" | "MEMBER";
  teamName: string | null;
  email: string | null;
};

export function LeagueFormingView({
  leagueId,
  name,
  inviteCode,
  rosterSettings,
  scoringSettings,
  season: initialSeason,
  liveSeason,
  members,
  isCommissioner,
  currentUserId,
}: {
  leagueId: string;
  name: string;
  inviteCode: string;
  rosterSettings: RosterSettings;
  scoringSettings: ScoringSettings;
  season: string;
  liveSeason: string;
  members: Member[];
  isCommissioner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [roster, setRoster] = useState<RosterSettings>(rosterSettings);
  const [scoring, setScoring] = useState<ScoringSettings>(scoringSettings);
  const [season, setSeason] = useState(initialSeason);
  const [error, setError] = useState<string | null>(null);

  function copyInviteCode() {
    navigator.clipboard.writeText(inviteCode);
    toast.success("Invite code copied.");
  }

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateLeagueSettings(leagueId, roster, scoring, season);
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("League settings saved.");
      router.refresh();
    });
  }

  function handleStartDraft() {
    setError(null);
    startTransition(async () => {
      const result = await startDraft(leagueId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const canStartDraft = members.length >= MIN_LEAGUE_MEMBERS;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <AutoRefresh intervalMs={8_000} />

      <div>
        <h1 className="font-heading text-3xl uppercase tracking-wide text-foreground">{name}</h1>
        <p className="text-sm text-muted-foreground">Forming — waiting for the draft to start.</p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
            Invite code
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <span className="font-mono text-2xl tracking-[0.3em] text-foreground">{inviteCode}</span>
          <Button variant="outline" size="sm" onClick={copyInviteCode}>
            Copy
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
            Members ({members.length}/{MAX_LEAGUE_MEMBERS})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border/60 p-0">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {m.teamName ?? m.email ?? "Unclaimed Team"}
                  {m.userId === currentUserId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
                  )}
                </div>
                {m.teamName && m.email && (
                  <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                )}
              </div>
              {m.role === "COMMISSIONER" && (
                <Badge variant="secondary" className="shrink-0">
                  Commissioner
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-negative">{error}</p>}

      {isCommissioner ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="font-heading text-sm uppercase tracking-wide text-muted-foreground">
              League setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Season
                </h4>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="season" className="text-xs text-muted-foreground">
                    Which NFL season to play against
                  </Label>
                  <Input
                    id="season"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className="max-w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    {season === liveSeason
                      ? `Live season — real scoring starts once ${liveSeason} games are played.`
                      : `A completed past season — the full schedule scores immediately with real, final stats.`}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Roster slots ({totalRosterSlots(roster)} total)
                </h4>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(Object.keys(roster) as (keyof RosterSettings)[]).map((key) => (
                    <div key={key} className="flex flex-col gap-1">
                      <Label htmlFor={`roster-${key}`} className="text-xs text-muted-foreground">
                        {ROSTER_SLOT_LABELS[key]}
                      </Label>
                      <Input
                        id={`roster-${key}`}
                        type="number"
                        min={0}
                        max={20}
                        value={roster[key]}
                        onChange={(e) =>
                          setRoster((r) => ({ ...r, [key]: Number(e.target.value) || 0 }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Scoring
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(scoring) as (keyof ScoringSettings)[]).map((key) => (
                    <div key={key} className="flex flex-col gap-1">
                      <Label htmlFor={`scoring-${key}`} className="text-xs text-muted-foreground">
                        {SCORING_FIELD_LABELS[key]}
                      </Label>
                      <Input
                        id={`scoring-${key}`}
                        type="number"
                        step="any"
                        value={scoring[key]}
                        onChange={(e) =>
                          setScoring((s) => ({ ...s, [key]: Number(e.target.value) || 0 }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" variant="outline" disabled={isPending} className="self-start">
                {isPending ? "Saving…" : "Save settings"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only the commissioner can edit roster and scoring settings.
        </p>
      )}

      {isCommissioner && (
        <div className="flex flex-col gap-2">
          {!canStartDraft && (
            <p className="text-sm text-muted-foreground">
              Need {MIN_LEAGUE_MEMBERS - members.length} more member
              {MIN_LEAGUE_MEMBERS - members.length === 1 ? "" : "s"} to start the draft.
            </p>
          )}
          <Button onClick={handleStartDraft} disabled={!canStartDraft || isPending} size="lg">
            {isPending ? "Starting…" : "Start draft"}
          </Button>
        </div>
      )}
    </div>
  );
}
