import Link from "next/link";
import { EmptyStateCard } from "@/components/empty-state-card";
import { TeamAvatar } from "@/components/matchup/team-avatar";
import { RosterPlayerRow, type RosterPlayerRowData } from "@/components/matchup/roster-player-row";
import { cn } from "@/lib/utils";
import type { MatchupSide } from "@/components/matchup/types";

type Status = "PREGAME" | "LIVE" | "FINAL";

const STATUS_COPY: Record<Status, string> = {
  PREGAME: "Lineups open · swap freely before kickoff",
  LIVE: "Scores updating live",
  FINAL: "Week complete",
};

function statusFor(week: number, maxWeek: number, mine: MatchupSide): Status {
  if (week < maxWeek) return "FINAL";
  if (mine.totalPoints > 0 || (mine.rows.some((r) => (r.points ?? 0) > 0))) return "LIVE";
  return "PREGAME";
}

function accentFor(side: MatchupSide): "positive" | "negative" {
  return side.winProbability >= 50 ? "positive" : "negative";
}

function TeamColumn({
  side,
  isMine,
  align,
}: {
  side: MatchupSide;
  isMine: boolean;
  align: "left" | "right";
}) {
  const accent = accentFor(side);
  const accentText = accent === "positive" ? "text-positive" : "text-negative";
  return (
    <Link
      href={`/matchup/team/${side.sleeperRosterId}?from=matchup`}
      className={cn("flex flex-col gap-2", align === "right" ? "items-end text-right" : "items-start")}
    >
      <TeamAvatar
        sleeperRosterId={side.sleeperRosterId}
        name={side.rosterName}
        logoUrl={side.logoUrl}
        accent={accent}
        uploadable={isMine}
      />
      <div className="min-w-0 max-w-[130px]">
        <div className={cn("truncate font-display text-lg tracking-wide", accentText)}>
          {side.rosterName}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {side.ownerName}
          {side.record && ` · ${side.record.wins}-${side.record.losses}${side.record.ties ? `-${side.record.ties}` : ""}`}
        </div>
      </div>
      <div className={cn("font-mono text-2xl font-bold", accentText)}>
        {Math.round(side.winProbability)}%
      </div>
    </Link>
  );
}

function PairedStarterRow({ mine, opponent }: { mine: RosterPlayerRowData | null; opponent: RosterPlayerRowData | null }) {
  const position = mine?.slot ?? mine?.position ?? opponent?.slot ?? opponent?.position ?? "";
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2.5">
      <div className="min-w-0">{mine && <RosterPlayerRow row={mine} />}</div>
      <span className="rounded-full border border-positive/40 px-2 py-0.5 text-center font-mono text-[10px] font-semibold uppercase tracking-wide text-positive">
        {position || "—"}
      </span>
      <div className="min-w-0">{opponent && <RosterPlayerRow row={opponent} align="right" />}</div>
    </div>
  );
}

export function MatchupView({
  week,
  maxWeek,
  mine,
  opponent,
}: {
  week: number;
  maxWeek: number;
  mine: MatchupSide | null;
  opponent: MatchupSide | null;
}) {
  if (!mine) {
    return (
      <EmptyStateCard
        title="No matchup yet"
        description="This week's matchup will show up here once your league's schedule is set."
      />
    );
  }

  const status = statusFor(week, maxWeek, mine);
  const leadingWinPct = Math.round(mine.winProbability);
  const rowCount = Math.max(mine.rows.length, opponent?.rows.length ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-1.5 rounded-full border border-positive/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-positive">
          <span className="h-1.5 w-1.5 rounded-full bg-positive" />
          {status}
        </div>

        <div className="flex items-start justify-between gap-3">
          <TeamColumn side={mine} isMine align="left" />

          <div className="relative flex min-w-0 flex-1 flex-col items-center gap-1 pt-2">
            <svg
              aria-hidden
              viewBox="0 0 100 110"
              className="pointer-events-none absolute inset-0 top-1/2 left-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 text-foreground/10"
            >
              <path
                d="M50 2 L94 18 V52 C94 82 74 100 50 108 C26 100 6 82 6 52 V18 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
            </svg>
            <span className="relative rounded-full border border-border bg-secondary px-2.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
              VS
            </span>
            <div className="relative font-mono text-3xl font-bold text-foreground">
              {mine.totalPoints.toFixed(1)} – {(opponent?.totalPoints ?? 0).toFixed(1)}
            </div>
            <div className="relative font-mono text-xs text-muted-foreground">
              <span className="uppercase tracking-wide">Proj</span>{" "}
              {mine.projectedPoints.toFixed(1)} – {(opponent?.projectedPoints ?? 0).toFixed(1)}
            </div>
          </div>

          {opponent ? (
            <TeamColumn side={opponent} isMine={false} align="right" />
          ) : (
            <div className="flex flex-col items-end gap-2 text-right">
              <TeamAvatar sleeperRosterId={-1} name="?" logoUrl={null} accent="negative" />
              <span className="text-xs text-muted-foreground">TBD</span>
            </div>
          )}
        </div>

        <div className="mt-5">
          <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-positive"
              style={{ width: `${leadingWinPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/matchup?tab=league"
          className="rounded-full border border-border bg-card px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
        >
          All Matchups
        </Link>
        <div className="flex items-center justify-between rounded-full border border-border bg-card px-2 py-2 text-xs font-semibold uppercase tracking-wide text-foreground">
          <Link
            href={`/matchup?week=${Math.max(week - 1, 1)}`}
            aria-disabled={week <= 1}
            className={cn(
              "px-2",
              week <= 1 ? "pointer-events-none text-muted-foreground/40" : "text-muted-foreground hover:text-foreground",
            )}
          >
            ‹
          </Link>
          <span>Week {week}</span>
          <Link
            href={`/matchup?week=${Math.min(week + 1, maxWeek)}`}
            aria-disabled={week >= maxWeek}
            className={cn(
              "px-2",
              week >= maxWeek ? "pointer-events-none text-muted-foreground/40" : "text-muted-foreground hover:text-foreground",
            )}
          >
            ›
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-center">
        <div className="font-heading text-sm uppercase tracking-wide text-foreground">{status}</div>
        <div className="text-xs text-muted-foreground">{STATUS_COPY[status]}</div>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <h3 className="border-b border-border px-4 py-2.5 font-heading text-xs uppercase tracking-wide text-positive">
          Starters
        </h3>
        <div className="flex flex-col divide-y divide-border/60">
          {Array.from({ length: rowCount }, (_, i) => (
            <PairedStarterRow
              key={mine.rows[i]?.sleeperPlayerId ?? opponent?.rows[i]?.sleeperPlayerId ?? i}
              mine={mine.rows[i] ?? null}
              opponent={opponent?.rows[i] ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
