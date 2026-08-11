"use client";

import { useMemo, useState } from "react";
import { PlayerRow, type MarketPlayer } from "@/components/market/player-row";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function MarketList({ players }: { players: MarketPlayer[] }) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string | null>(null);

  const positions = useMemo(
    () => Array.from(new Set(players.map((p) => p.position))).sort(),
    [players],
  );

  const filtered = players.filter((p) => {
    if (position && p.position !== position) return false;
    if (query && !p.fullName.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setPosition(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors",
              position === null
                ? "border-primary bg-primary/20 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            All
          </button>
          {positions.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosition(pos)}
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

      <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No players match.
          </p>
        ) : (
          filtered.map((player) => <PlayerRow key={player.id} player={player} />)
        )}
      </div>
    </div>
  );
}
