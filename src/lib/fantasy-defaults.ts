// Standard defaults matching what ESPN/Yahoo/Sleeper all ship out of the box — used to seed
// a new Arc-native league's settings, editable afterward by the commissioner.

export type RosterSettings = {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number; // RB/WR/TE
  SUPERFLEX: number; // QB/RB/WR/TE
  DEF: number;
  K: number;
  BENCH: number;
};

export const DEFAULT_ROSTER_SETTINGS: RosterSettings = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  DEF: 1,
  K: 1,
  BENCH: 6,
};

export function totalRosterSlots(settings: RosterSettings): number {
  return Object.values(settings).reduce((sum, n) => sum + n, 0);
}

export type ScoringSettings = {
  passingTd: number;
  passingYardsPerPoint: number; // e.g. 0.04 = 1 point per 25 yards
  interception: number;
  rushingTd: number;
  rushingYardsPerPoint: number; // e.g. 0.1 = 1 point per 10 yards
  receivingTd: number;
  receivingYardsPerPoint: number;
  reception: number; // PPR value
  fumbleLost: number;
};

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  passingTd: 4,
  passingYardsPerPoint: 0.04,
  interception: -2,
  rushingTd: 6,
  rushingYardsPerPoint: 0.1,
  receivingTd: 6,
  receivingYardsPerPoint: 0.1,
  reception: 1,
  fumbleLost: -2,
};

export const ROSTER_SLOT_LABELS: Record<keyof RosterSettings, string> = {
  QB: "Quarterback",
  RB: "Running Back",
  WR: "Wide Receiver",
  TE: "Tight End",
  FLEX: "Flex (RB/WR/TE)",
  SUPERFLEX: "Superflex (Any offensive player)",
  DEF: "Defense",
  K: "Kicker",
  BENCH: "Bench",
};

export const SCORING_FIELD_LABELS: Record<keyof ScoringSettings, string> = {
  passingTd: "Passing TD",
  passingYardsPerPoint: "Points per passing yard",
  interception: "Interception thrown",
  rushingTd: "Rushing TD",
  rushingYardsPerPoint: "Points per rushing yard",
  receivingTd: "Receiving TD",
  receivingYardsPerPoint: "Points per receiving yard",
  reception: "Points per reception (PPR)",
  fumbleLost: "Fumble lost",
};

const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read aloud

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

export const MIN_LEAGUE_MEMBERS = 4;
export const MAX_LEAGUE_MEMBERS = 32;
