"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerAvatar } from "@/components/player-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { currentRound, whoseTurnMemberId } from "@/lib/draft-order";
import { DEFAULT_ROSTER_SETTINGS, totalRosterSlots } from "@/lib/fantasy-defaults";

export type DraftablePlayer = {
  nflverseId: string;
  headshotUrl: string | null;
  name: string;
  team: string | null;
  position: string;
  lastSeasonPoints: number | null;
};

type Pick = {
  pickNo: number;
  round: number;
  teamId: string;
  player: DraftablePlayer;
};

const TEAM_COUNT_OPTIONS = [8, 10, 12, 14];
const TOTAL_ROSTER_SLOTS = totalRosterSlots(DEFAULT_ROSTER_SETTINGS);

// Fixed cap table tuned to DEFAULT_ROSTER_SETTINGS's shape (sums well above one team's
// total slots — see fantasy-defaults.ts — so bots stop stacking QBs long before this
// could legitimately run out of eligible positions).
const POSITION_CAP: Record<string, number> = { QB: 3, RB: 6, WR: 6, TE: 2, DEF: 1, K: 1 };

function teamLabel(teamId: string | null): string {
  if (!teamId) return "—";
  if (teamId === "user") return "You";
  return `Team ${teamId.split("-")[1]}`;
}

function pickForBot(teamId: string, picks: Pick[], availablePlayers: DraftablePlayer[]): DraftablePlayer | null {
  if (availablePlayers.length === 0) return null;
  const countsSoFar: Record<string, number> = {};
  for (const p of picks) {
    if (p.teamId !== teamId) continue;
    countsSoFar[p.player.position] = (countsSoFar[p.player.position] ?? 0) + 1;
  }
  let eligible = availablePlayers.filter(
    (p) => (countsSoFar[p.position] ?? 0) < (POSITION_CAP[p.position] ?? Infinity),
  );
  if (eligible.length === 0) eligible = availablePlayers;
  // availablePlayers arrives pre-sorted desc by lastSeasonPoints (server-computed), and
  // .filter() preserves order, so the first eligible entry is already the best available.
  return eligible[0] ?? null;
}

function PlayerRow({
  player,
  canDraft,
  onDraft,
}: {
  player: DraftablePlayer;
  canDraft: boolean;
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
        disabled={!canDraft}
        onClick={() => onDraft(player)}
        className="shrink-0"
      >
        {canDraft ? "Draft" : "Not your turn"}
      </Button>
    </div>
  );
}

export function MockDraftClient({ players }: { players: DraftablePlayer[] }) {
  const [phase, setPhase] = useState<"setup" | "drafting" | "complete">("setup");
  const [teamCount, setTeamCount] = useState(10);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [currentPickNo, setCurrentPickNo] = useState(0);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string | null>(null);

  const totalPicks = draftOrder.length * TOTAL_ROSTER_SLOTS;

  const availablePlayers = useMemo(() => {
    const draftedIds = new Set(picks.map((p) => p.player.nflverseId));
    return players.filter((p) => !draftedIds.has(p.nflverseId));
  }, [players, picks]);

  const onTheClockTeamId = whoseTurnMemberId(draftOrder, currentPickNo);
  const isUserTurn = onTheClockTeamId === "user";

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

  function recordPick(teamId: string, player: DraftablePlayer) {
    const pickNo = picks.length + 1;
    const round = currentRound(picks.length, draftOrder.length) + 1;
    setPicks((prev) => [...prev, { pickNo, round, teamId, player }]);
    const next = currentPickNo + 1;
    setCurrentPickNo(next);
    if (next >= totalPicks) setPhase("complete");
  }

  // Bot's turn: auto-pick after a short delay so it reads as a real draft happening,
  // not an instant dump. Depends on currentPickNo/draftOrder, so it only fires once per
  // turn — the next state update (from recordPick) advances currentPickNo, which changes
  // whoseTurnMemberId's result and cleans up this effect before a new one starts.
  useEffect(() => {
    if (phase !== "drafting") return;
    if (currentPickNo >= totalPicks) return;
    const teamId = whoseTurnMemberId(draftOrder, currentPickNo);
    if (!teamId || teamId === "user") return;
    const timer = setTimeout(() => {
      const player = pickForBot(teamId, picks, availablePlayers);
      if (player) recordPick(teamId, player);
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recordPick reads picks/currentPickNo from closure by design (see comment above)
  }, [phase, currentPickNo, draftOrder, availablePlayers]);

  function handleStart() {
    const baseIds = ["user", ...Array.from({ length: teamCount - 1 }, (_, i) => `bot-${i + 2}`)];
    const order = [...baseIds];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    setDraftOrder(order);
    setPicks([]);
    setCurrentPickNo(0);
    setQuery("");
    setPosition(null);
    setPhase("drafting");
  }

  function handleReset() {
    setPhase("setup");
    setDraftOrder([]);
    setPicks([]);
    setCurrentPickNo(0);
  }

  if (phase === "setup") {
    return (
      <Card className="w-full border-border bg-card">
        <CardHeader>
          <CardTitle className="font-heading text-xl uppercase tracking-wide text-foreground">
            Set up your mock draft
          </CardTitle>
          <CardDescription>Draft against {teamCount - 1} bot opponents.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Teams</span>
            <div className="flex gap-1.5">
              {TEAM_COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  onClick={() => setTeamCount(n)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    teamCount === n
                      ? "border-primary bg-primary/20 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={handleStart} className="w-full">
            Start Mock Draft
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "complete") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">Mock draft complete.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {draftOrder.map((teamId) => (
            <Card key={teamId} className="border-border bg-card">
              <CardHeader>
                <CardTitle className="font-heading text-sm uppercase tracking-wide text-foreground">
                  {teamLabel(teamId)}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border/60 p-0">
                {picks
                  .filter((p) => p.teamId === teamId)
                  .map((p) => (
                    <div
                      key={p.player.nflverseId}
                      className="flex items-center justify-between gap-3 px-4 py-2"
                    >
                      <span className="truncate text-sm text-foreground">{p.player.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {p.player.team ?? "FA"} · {p.player.position}
                      </span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </div>
        <Button onClick={handleReset} className="w-full">
          Start Another Mock Draft
        </Button>
      </div>
    );
  }

  const overallPick = currentPickNo + 1;
  const round = currentRound(currentPickNo, draftOrder.length) + 1;
  const pickInRound = (currentPickNo % draftOrder.length) + 1;
  const recentPicks = [...picks].sort((a, b) => b.pickNo - a.pickNo);

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center gap-1 py-5 text-center">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Pick {overallPick} of {totalPicks} · Round {round}, Pick {pickInRound}
          </p>
          {isUserTurn ? (
            <p className="font-heading text-xl uppercase tracking-wide text-primary">
              You&apos;re on the clock
            </p>
          ) : (
            <p className="font-heading text-xl uppercase tracking-wide text-foreground">
              On the clock: {teamLabel(onTheClockTeamId)}
            </p>
          )}
        </CardContent>
      </Card>

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
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                position === pos
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      {isBrowsing ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col divide-y divide-border/60 p-0">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No matching players.</p>
            ) : (
              filtered
                .slice(0, 50)
                .map((p) => (
                  <PlayerRow key={p.nflverseId} player={p} canDraft={isUserTurn} onDraft={(pl) => recordPick("user", pl)} />
                ))
            )}
          </CardContent>
        </Card>
      ) : (
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
                <PlayerRow key={p.nflverseId} player={p} canDraft={isUserTurn} onDraft={(pl) => recordPick("user", pl)} />
              ))
            )}
          </CardContent>
        </Card>
      )}

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
              <div
                key={`${pick.pickNo}-${pick.player.nflverseId}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {pick.player.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {pick.player.team ?? "FA"} · {pick.player.position}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {teamLabel(pick.teamId)}
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
