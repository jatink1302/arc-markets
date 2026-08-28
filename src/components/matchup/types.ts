import type { RosterPlayerRowData } from "@/components/matchup/roster-player-row";

export type MatchupSide = {
  sleeperRosterId: number;
  rosterName: string; // team name (falls back to owner name if none set)
  ownerName: string;
  logoUrl: string | null;
  record: { wins: number; losses: number; ties: number } | null;
  rows: RosterPlayerRowData[];
  totalPoints: number;
  // Sum of each starter's average points-per-game from last season — a simple, honest
  // estimate (this app has no real projections data source), not a sophisticated model.
  projectedPoints: number;
  winProbability: number; // 0-100, derived from projectedPoints; 50/50 if both sides are 0
};

export type StandingsRow = {
  sleeperRosterId: number;
  name: string;
  logoUrl: string | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
};

export type MatchupPairingSide = { sleeperRosterId: number; name: string; points: number };

export type WeekMatchupPairing = {
  matchupId: number;
  teamA: MatchupPairingSide;
  teamB: MatchupPairingSide | null; // null if Sleeper hasn't paired an opponent (bye/odd team count)
};
