export type ActivityEntry =
  | {
      id: string;
      type: "DRAFT_PICK" | "FREE_AGENT_ADD";
      at: Date;
      teamName: string;
      playerName: string;
      playerPosition: string | null;
      playerTeam: string | null;
      round: number | null;
    }
  | {
      id: string;
      type: "DROP";
      at: Date;
      teamName: string;
      playerName: string;
      playerPosition: string | null;
      playerTeam: string | null;
    }
  | {
      id: string;
      type: "TRADE";
      at: Date;
      items: {
        playerName: string;
        playerPosition: string | null;
        fromTeamName: string;
        toTeamName: string;
      }[];
    };

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const VERB_BY_TYPE: Record<"DRAFT_PICK" | "FREE_AGENT_ADD" | "DROP", string> = {
  DRAFT_PICK: "drafted",
  FREE_AGENT_ADD: "added",
  DROP: "dropped",
};

export function ActivityView({ entries }: { entries: ActivityEntry[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
        Activity
      </h3>
      <div className="flex flex-col divide-y divide-border/60">
        {entries.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          entries.map((entry) => {
            if (entry.type === "TRADE") {
              return (
                <div key={entry.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">Trade</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatDate(entry.at)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-md bg-secondary/30 p-2">
                    {entry.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {item.playerName}
                        </span>
                        <span className="max-w-[55%] shrink-0 truncate text-muted-foreground">
                          {item.fromTeamName} → {item.toTeamName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <span className="text-sm text-foreground">
                    <span className="font-medium">{entry.teamName}</span>{" "}
                    {VERB_BY_TYPE[entry.type]} {entry.playerName}
                  </span>
                  <div className="truncate text-xs text-muted-foreground">
                    {entry.playerTeam ?? "FA"} · {entry.playerPosition ?? "—"}
                    {entry.type === "DRAFT_PICK" && entry.round != null
                      ? ` · Round ${entry.round}`
                      : ""}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatDate(entry.at)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
