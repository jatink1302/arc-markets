"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoRefresh } from "@/components/auto-refresh";
import { makePick } from "@/app/actions/fantasy-league";
import { currentRound, whoseTurnMemberId } from "@/lib/draft-order";
import { totalRosterSlots, type RosterSettings } from "@/lib/fantasy-defaults";

export type DraftMember = {
  id: string;
  userId: string;
  teamName: string | null;
  email: string;
};

export type DraftPick = {
  id: string;
  pickNo: number;
  round: number | null;
  memberId: string;
  nflverseId: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
};

export type DraftablePlayer = {
  nflverseId: string;
  headshotUrl: string | null;
  name: string;
  team: string | null;
  position: string;
  lastSeasonPoints: number | null;
};

function memberLabel(member: DraftMember | undefined): string {
  if (!member) return "—";
  return member.teamName ?? member.email;
}

function PlayerRow({
  player,
  canDraft,
  isPending,
  onDraft,
}: {
  player: DraftablePlayer;
  canDraft: boolean;
  isPending: boolean;
  onDraft: (player: DraftablePlayer) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar headshotUrl={player.headshotUrl} name={player.name} className="h-9 w-9" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{player.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {player.team ?? "FA"} · {player.position}
            {player.lastSeasonPoints !== null &&
              ` · ${player.lastSeasonPoints.toFixed(1)} pts last season`}
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant={canDraft ? "default" : "outline"}
        disabled={!canDraft || isPending}
        onClick={() => onDraft(player)}
        className="shrink-0"
      >
        {canDraft ? (isPending ? "Drafting…" : "Draft") : "Not your turn"}
      </Button>
    </div>
  );
}

export function DraftBoard({
  leagueId,
  members,
  draftOrder,
  currentPickNo,
  rosterSettings,
  picks,
  availablePlayers,
  currentUserId,
}: {
  leagueId: string;
  members: DraftMember[];
  draftOrder: string[];
  currentPickNo: number;
  rosterSettings: RosterSettings;
  picks: DraftPick[];
  availablePlayers: DraftablePlayer[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const myMemberId = members.find((m) => m.userId === currentUserId)?.id ?? null;

  const onTheClockMemberId = whoseTurnMemberId(draftOrder, currentPickNo);
  const isMyTurn = onTheClockMemberId !== null && onTheClockMemberId === myMemberId;

  const totalPicks = draftOrder.length * totalRosterSlots(rosterSettings);
  const overallPick = currentPickNo + 1;
  const round = currentRound(currentPickNo, draftOrder.length) + 1;
  const pickInRound = (currentPickNo % draftOrder.length) + 1;

  const positions = useMemo(
    () => Array.from(new Set(availablePlayers.map((p) => p.position))).sort(),
    [availablePlayers],
  );
  const isBrowsing = query.trim().length > 0 || position !== null;
  const filtered = useMemo(() => {
    if (!isBrowsing) return [];
    return availablePlayers.filter((p) => {
      if (position && p.position !== position) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [availablePlayers, query, position, isBrowsing]);
  const topAvailable = availablePlayers.slice(0, 10);

  function handleDraft(player: DraftablePlayer) {
    setError(null);
    startTransition(async () => {
      const result = await makePick(leagueId, {
        nflverseId: player.nflverseId,
        name: player.name,
        team: player.team,
        position: player.position,
      });
      if (!result.success) {
        toast.error(result.error);
        setError(result.error);
        return;
      }
      toast.success(`Drafted ${player.name}.`);
    });
  }

  const recentPicks = [...picks].sort((a, b) => b.pickNo - a.pickNo);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <AutoRefresh intervalMs={5_000} />

      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center gap-1 py-5 text-center">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Pick {overallPick} of {totalPicks} · Round {round}, Pick {pickInRound}
          </p>
          {isMyTurn ? (
            <p className="font-heading text-xl uppercase tracking-wide text-primary">
              You&apos;re on the clock
            </p>
          ) : (
            <p className="font-heading text-xl uppercase tracking-wide text-foreground">
              On the clock: {memberLabel(membersById.get(onTheClockMemberId ?? ""))}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
            Top available
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border/60 p-0">
          {topAvailable.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No players left to draft.</p>
          ) : (
            topAvailable.map((p) => (
              <PlayerRow
                key={p.nflverseId}
                player={p}
                canDraft={isMyTurn}
                isPending={isPending}
                onDraft={handleDraft}
              />
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder={`Search ${availablePlayers.length.toLocaleString()} available players…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            {positions.map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(position === pos ? null : pos)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  position === pos
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {isBrowsing && (
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col divide-y divide-border/60 p-0">
              {filtered.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No matching players.</p>
              ) : (
                filtered
                  .slice(0, 50)
                  .map((p) => (
                    <PlayerRow
                      key={p.nflverseId}
                      player={p}
                      canDraft={isMyTurn}
                      isPending={isPending}
                      onDraft={handleDraft}
                    />
                  ))
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {error && <p className="text-sm text-negative">{error}</p>}

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
            Pick history
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border/60 p-0">
          {recentPicks.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No picks yet.</p>
          ) : (
            recentPicks.map((pick) => (
              <div key={pick.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {pick.playerName}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {pick.playerTeam ?? "FA"} · {pick.playerPosition}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {memberLabel(membersById.get(pick.memberId))}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 font-mono">
                  {pick.round}.{String(((pick.pickNo - 1) % draftOrder.length) + 1).padStart(2, "0")}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
