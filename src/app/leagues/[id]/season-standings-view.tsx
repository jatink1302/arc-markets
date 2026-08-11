import Link from "next/link";
import { TeamBadge } from "@/components/matchup/team-badge";

export type SeasonStandingsRowData = {
  memberId: string;
  teamName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

export function SeasonStandingsView({
  leagueId,
  rows,
}: {
  leagueId: string;
  rows: SeasonStandingsRowData[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
        Standings
      </h3>
      <div className="flex flex-col divide-y divide-border/60">
        {rows.map((row, i) => (
          <div key={row.memberId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <Link
              href={`/leagues/${leagueId}/team/${row.memberId}`}
              className="flex items-center gap-3 hover:opacity-80"
            >
              <span className="w-4 font-mono text-xs text-muted-foreground">{i + 1}</span>
              <TeamBadge name={row.teamName} size="sm" />
              <span className="text-sm font-medium text-foreground">{row.teamName}</span>
            </Link>
            <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
              <span>
                {row.wins}-{row.losses}
                {row.ties > 0 ? `-${row.ties}` : ""}
              </span>
              <span className="text-foreground">{row.pointsFor.toFixed(1)} PF</span>
              <span>{row.pointsAgainst.toFixed(1)} PA</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
