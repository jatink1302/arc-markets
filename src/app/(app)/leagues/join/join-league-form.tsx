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
import { joinLeague } from "@/app/actions/fantasy-league";

export function JoinLeagueForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inviteCode, setInviteCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await joinLeague(inviteCode, teamName);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/leagues/${result.leagueId}`);
    });
  }

  return (
    <Card className="w-full max-w-sm border-border bg-card">
      <CardHeader>
        <CardTitle className="font-heading text-2xl uppercase tracking-wide text-foreground">
          Join a league
        </CardTitle>
        <CardDescription>Enter the invite code your commissioner shared with you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="inviteCode">Invite code</Label>
            <Input
              id="inviteCode"
              required
              autoFocus
              autoCapitalize="characters"
              placeholder="e.g. 7F3K9Q"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="font-mono uppercase tracking-widest"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="teamName">Team name (optional)</Label>
            <Input
              id="teamName"
              placeholder="e.g. Jatin's Juggernauts"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Joining…" : "Join league"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
