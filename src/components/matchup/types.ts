import type { RosterPlayerRowData } from "@/components/matchup/roster-player-row";

export type MatchupSide = {
  sleeperRosterId: number;
  rosterName: string;
  rows: RosterPlayerRowData[];
  totalPoints: number;
};

export type StandingsRow = {
  sleeperRosterId: number;
  name: string;
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
