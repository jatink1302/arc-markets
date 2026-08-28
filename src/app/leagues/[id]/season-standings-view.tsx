import Link from "next/link";
import { TeamAvatar } from "@/components/matchup/team-avatar";

export type SeasonStandingsRowData = {
  memberId: string;
  teamName: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

export function SeasonStandingsView({
  leagueId,
  myMemberId,
  rows,
}: {
  leagueId: string;
  myMemberId: string | null;
  rows: SeasonStandingsRowData[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-muted-foreground">
        Standings
      </h3>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-1.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
        <span>Team</span>
        <div className="flex shrink-0 gap-3">
          <span className="w-12 text-right">Rec</span>
          <span className="w-12 text-right">PF</span>
          <span className="w-12 text-right">PA</span>
        </div>
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {rows.map((row, i) => (
          <div key={row.memberId} className="flex items-center justify-between gap-2 px-4 py-2.5">
            <Link
              href={`/leagues/${leagueId}/team/${row.memberId}`}
              className="flex min-w-0 flex-1 items-center gap-2 hover:opacity-80"
            >
              <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}</span>
              <TeamAvatar
                sleeperRosterId={null}
                name={row.teamName}
                logoUrl={row.logoUrl}
                accent="positive"
                size="sm"
              />
              <span className="min-w-0 truncate font-display text-sm tracking-wide text-foreground">
                {row.teamName}
              </span>
              {row.memberId === myMemberId && (
                <span className="shrink-0 text-xs text-muted-foreground">(You)</span>
              )}
            </Link>
            <div className="flex shrink-0 gap-3 font-mono text-xs text-muted-foreground">
              <span className="w-12 text-right">
                {row.wins}-{row.losses}
                {row.ties > 0 ? `-${row.ties}` : ""}
              </span>
              <span className="w-12 text-right text-foreground">{row.pointsFor.toFixed(1)}</span>
              <span className="w-12 text-right">{row.pointsAgainst.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
