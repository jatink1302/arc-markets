// Standard 14-week regular season, no playoff bracket — see plan simplifications.
export const SEASON_WEEKS = 14;

export type ScheduledMatchup = { week: number; memberAId: string; memberBId: string | null };

const BYE = "__BYE__";

// Circle method round-robin: fix the first id, rotate everyone else one position each round,
// pairing opposite ends of the remaining list. An odd member count gets a sentinel "BYE" seat
// added so the algorithm stays even; whichever real member draws it that round gets a bye week
// (memberBId: null). Cycles back to round 1 if numWeeks exceeds a full round-robin's length.
export function generateRoundRobinSchedule(
  memberIds: string[],
  numWeeks: number = SEASON_WEEKS,
): ScheduledMatchup[] {
  const ids = [...memberIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 !== 0) ids.push(BYE);

  const n = ids.length;
  const rounds: [string, string][][] = [];
  const arr = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      pairs.push([arr[i], arr[n - 1 - i]]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!); // rotate everyone but the fixed first seat
  }

  const schedule: ScheduledMatchup[] = [];
  for (let week = 1; week <= numWeeks; week++) {
    const round = rounds[(week - 1) % rounds.length];
    for (const [a, b] of round) {
      if (a === BYE) schedule.push({ week, memberAId: b, memberBId: null });
      else if (b === BYE) schedule.push({ week, memberAId: a, memberBId: null });
      else schedule.push({ week, memberAId: a, memberBId: b });
    }
  }
  return schedule;
}
