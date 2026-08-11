"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { lookupSleeperLeagues, importLeague } from "@/app/actions/sleeper";
import type { SleeperLeague } from "@/lib/sleeper";

export function OnboardingFlow() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [sleeperUserId, setSleeperUserId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<SleeperLeague[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await lookupSleeperLeagues(username);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSleeperUserId(result.sleeperUserId);
      setLeagues(result.leagues);
    });
  }

  function handleSelectLeague(league: SleeperLeague) {
    if (!sleeperUserId) return;
    setError(null);
    startTransition(async () => {
      const result = await importLeague(sleeperUserId, username, league);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.replace("/matchup");
    });
  }

  return (
    <Card className="w-full max-w-sm border-border bg-card">
      <CardHeader>
        <CardTitle className="font-heading text-2xl uppercase tracking-wide text-foreground">
          Connect Sleeper
        </CardTitle>
        <CardDescription>
          {leagues
            ? "Pick a league to import."
            : "Enter your Sleeper username to find your leagues."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!leagues ? (
          <form onSubmit={handleLookup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Sleeper username</Label>
              <Input
                id="username"
                required
                autoFocus
                placeholder="e.g. jatinkumar"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-negative">{error}</p>}
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Looking up…" : "Find leagues"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            {leagues.map((league) => (
              <button
                key={league.league_id}
                disabled={isPending}
                onClick={() => handleSelectLeague(league)}
                className="flex items-center justify-between rounded-md border border-border bg-secondary px-3 py-2.5 text-left transition-colors hover:border-primary disabled:opacity-50"
              >
                <span className="font-medium text-foreground">{league.name}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {league.total_rosters} teams
                </span>
              </button>
            ))}
            {error && <p className="text-sm text-negative">{error}</p>}
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setLeagues(null);
                setSleeperUserId(null);
              }}
            >
              Back
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
