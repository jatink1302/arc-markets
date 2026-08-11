"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/player-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addFreeAgent } from "@/app/actions/fantasy-free-agency";

export type FreeAgentPlayer = {
  nflverseId: string;
  headshotUrl: string | null;
  name: string;
  team: string | null;
  position: string;
  seasonPoints: number;
};

export type FreeAgentDropOption = {
  id: string;
  playerName: string;
  playerPosition: string | null;
};

function FreeAgentRow({
  player,
  atCapacity,
  myPicks,
  isPending,
  onAdd,
}: {
  player: FreeAgentPlayer;
  atCapacity: boolean;
  myPicks: FreeAgentDropOption[];
  isPending: boolean;
  onAdd: (player: FreeAgentPlayer, dropPickId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropId, setDropId] = useState<string | null>(null);

  function handleAddClick() {
    if (!atCapacity) {
      onAdd(player);
      return;
    }
    setOpen(true);
  }

  function confirmDrop() {
    if (!dropId) return;
    onAdd(player, dropId);
    setOpen(false);
    setDropId(null);
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerAvatar headshotUrl={player.headshotUrl} name={player.name} className="h-9 w-9" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{player.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {player.team ?? "FA"} · {player.position} · {player.seasonPoints.toFixed(1)} pts this season
            </div>
          </div>
        </div>
        {!open && (
          <Button size="sm" disabled={isPending} onClick={handleAddClick} className="shrink-0">
            {isPending ? "Adding…" : "Add"}
          </Button>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-secondary/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Your roster is full — drop a player to make room:
          </p>
          <div className="flex flex-col gap-1">
            {myPicks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No players to drop.</p>
            ) : (
              myPicks.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-foreground">
                  <input
                    type="radio"
                    name={`drop-for-${player.nflverseId}`}
                    checked={dropId === p.id}
                    onChange={() => setDropId(p.id)}
                  />
                  {p.playerName}
                  {p.playerPosition && (
                    <span className="text-muted-foreground">· {p.playerPosition}</span>
                  )}
                </label>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending || !dropId} onClick={confirmDrop}>
              {isPending ? "Adding…" : "Confirm swap"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setOpen(false);
                setDropId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FreeAgentsView({
  leagueId,
  availablePlayers,
  myPicks,
  rosterCap,
  myActivePickCount,
}: {
  leagueId: string;
  availablePlayers: FreeAgentPlayer[];
  myPicks: FreeAgentDropOption[];
  rosterCap: number;
  myActivePickCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string | null>(null);

  const atCapacity = myActivePickCount >= rosterCap;

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

  function handleAdd(player: FreeAgentPlayer, dropPickId?: string) {
    startTransition(async () => {
      const result = await addFreeAgent(
        leagueId,
        {
          nflverseId: player.nflverseId,
          name: player.name,
          team: player.team,
          position: player.position,
        },
        dropPickId,
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added ${player.name}.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {atCapacity && (
        <p className="text-xs text-muted-foreground">
          Your roster is full ({rosterCap} slots) — adding a free agent will ask you to drop
          someone first.
        </p>
      )}

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
            Top available
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border/60 p-0">
          {topAvailable.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No free agents available.</p>
          ) : (
            topAvailable.map((p) => (
              <FreeAgentRow
                key={p.nflverseId}
                player={p}
                atCapacity={atCapacity}
                myPicks={myPicks}
                isPending={isPending}
                onAdd={handleAdd}
              />
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            placeholder={`Search ${availablePlayers.length.toLocaleString()} free agents…`}
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
                    <FreeAgentRow
                      key={p.nflverseId}
                      player={p}
                      atCapacity={atCapacity}
                      myPicks={myPicks}
                      isPending={isPending}
                      onAdd={handleAdd}
                    />
                  ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
