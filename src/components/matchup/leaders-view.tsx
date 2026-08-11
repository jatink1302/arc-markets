"use client";

import { useMemo, useState } from "react";
import { PlayerAvatar } from "@/components/player-avatar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type LeaderPlayer = {
  nflverseId: string;
  headshotUrl: string | null;
  name: string;
  team: string | null;
  position: string;
  lastSeasonPoints: number | null;
  ownerName: string | null; // null = free agent / available
};

function LeaderRow({ player }: { player: LeaderPlayer }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar headshotUrl={player.headshotUrl} name={player.name} className="h-9 w-9" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{player.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {player.team ?? "FA"} · {player.position}
            {player.ownerName ? ` · ${player.ownerName}` : ""}
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right font-mono text-xs">
        {player.lastSeasonPoints !== null ? (
          <div className="text-foreground">{player.lastSeasonPoints.toFixed(1)} pts last season</div>
        ) : (
          <div className="text-muted-foreground">No stats last season</div>
        )}
      </div>
    </div>
  );
}

export function LeadersView({
  players,
  previousSeason,
}: {
  players: LeaderPlayer[];
  previousSeason: string;
}) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);

  const positions = useMemo(
    () => Array.from(new Set(players.map((p) => p.position))).sort(),
    [players],
  );

  const scoped = useMemo(
    () => (availableOnly ? players.filter((p) => p.ownerName === null) : players),
    [players, availableOnly],
  );

  const isBrowsing = query.trim().length > 0 || position !== null;

  const filtered = useMemo(() => {
    if (!isBrowsing) return [];
    return scoped.filter((p) => {
      if (position && p.position !== position) return false;
      if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [scoped, query, position, isBrowsing]);

  const top = scoped.slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      {availableOnly && (
        <div className="rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
          Browse only — Sleeper doesn&apos;t support adding or dropping players through
          third-party apps, so waiver moves still happen in the Sleeper app.
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
          {availableOnly
            ? `Best available — by real ${previousSeason} performance`
            : `Leaders — by real ${previousSeason} performance`}
        </h3>
        <div className="flex flex-col divide-y divide-border/60">
          {top.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No players found.</p>
          ) : (
            top.map((p) => <LeaderRow key={p.nflverseId} player={p} />)
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              placeholder={`Search ${scoped.length.toLocaleString()} players…`}
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
                    "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors",
                    position === pos
                      ? "border-primary bg-primary/20 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {pos}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setAvailableOnly((v) => !v)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs font-medium transition-colors sm:self-auto",
              availableOnly
                ? "border-primary bg-primary/20 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                availableOnly ? "border-primary bg-primary" : "border-border",
              )}
            >
              {availableOnly && (
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-primary-foreground" fill="none">
                  <path
                    d="M2 6l2.5 2.5L10 3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            Available only
          </button>
        </div>

        {isBrowsing && (
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No players match.</p>
            ) : (
              filtered.slice(0, 100).map((p) => <LeaderRow key={p.nflverseId} player={p} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
