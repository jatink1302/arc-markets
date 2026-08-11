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
import { createLeague } from "@/app/actions/fantasy-league";

export function CreateLeagueForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createLeague(name);
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
          Start a league
        </CardTitle>
        <CardDescription>
          You&apos;ll be the commissioner — invite 3 to 31 others, then start the draft
          whenever you&apos;re ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">League name</Label>
            <Input
              id="name"
              required
              autoFocus
              placeholder="e.g. The Gridiron Gauntlet"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? "Creating…" : "Create league"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
