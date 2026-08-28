import Link from "next/link";
import { EmptyStateCard } from "@/components/empty-state-card";
import { TeamAvatar } from "@/components/matchup/team-avatar";
import { RosterPlayerRow, type RosterPlayerRowData } from "@/components/matchup/roster-player-row";

export function TeamView({
  teamName,
  sleeperRosterId,
  logoUrl,
  starters,
  bench,
  isOwnTeam = false,
  record,
  rank,
  totalTeams,
  backHref,
  backLabel,
}: {
  teamName: string | null;
  sleeperRosterId?: number | null;
  logoUrl?: string | null;
  starters: RosterPlayerRowData[];
  bench: RosterPlayerRowData[];
  isOwnTeam?: boolean;
  record?: { wins: number; losses: number; ties: number } | null;
  rank?: number | null;
  totalTeams?: number;
  backHref?: string;
  backLabel?: string;
}) {
  if (!teamName) {
    return (
      <EmptyStateCard
        title="No roster found"
        description="We couldn't match your Sleeper account to a team in this league."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {backHref && (
        <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">
          ← {backLabel ?? "Back"}
        </Link>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {sleeperRosterId != null && (
            <TeamAvatar
              sleeperRosterId={sleeperRosterId}
              name={teamName}
              logoUrl={logoUrl ?? null}
              accent="positive"
              size="sm"
              uploadable={isOwnTeam}
            />
          )}
          <div>
            <h2 className="font-heading text-lg uppercase tracking-wide text-foreground">
              {teamName}
            </h2>
            {(record || rank) && (
              <p className="font-mono text-xs text-muted-foreground">
                {record && (
                  <>
                    {record.wins}-{record.losses}
                    {record.ties > 0 ? `-${record.ties}` : ""}
                  </>
                )}
                {record && rank ? " · " : ""}
                {rank && `#${rank}${totalTeams ? ` of ${totalTeams}` : ""}`}
              </p>
            )}
          </div>
        </div>
        {isOwnTeam && (
          <Link href="/portfolio" className="shrink-0 text-xs text-primary hover:underline">
            View your positions →
          </Link>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
          Starters
        </h3>
        <div className="flex flex-col divide-y divide-border/60">
          {starters.map((row) => (
            <RosterPlayerRow key={row.sleeperPlayerId} row={row} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
          Bench
        </h3>
        <div className="flex flex-col divide-y divide-border/60">
          {bench.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Empty bench.</p>
          ) : (
            bench.map((row) => <RosterPlayerRow key={row.sleeperPlayerId} row={row} />)
          )}
        </div>
      </div>
    </div>
  );
}
