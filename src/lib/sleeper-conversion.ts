import {
  DEFAULT_SCORING_SETTINGS,
  type RosterSettings,
  type ScoringSettings,
} from "@/lib/fantasy-defaults";

// Pure, no DB/network — used identically by both the conversion preview and the real
// conversion, so what a user is shown before converting is exactly what they get.

const TIERED_RECEPTION_KEYS = ["rec_0_4", "rec_5_9", "rec_10_19", "rec_20_29", "rec_30_39", "rec_40p"];

export function mapSleeperScoring(
  raw: Record<string, number>,
): { scoring: ScoringSettings; limitations: string[] } {
  const limitations: string[] = [];
  const num = (key: string): number | undefined =>
    typeof raw[key] === "number" ? raw[key] : undefined;

  const hasTieredReception = TIERED_RECEPTION_KEYS.some((k) => (num(k) ?? 0) !== 0);
  const flatReception = num("rec");
  let reception = DEFAULT_SCORING_SETTINGS.reception;
  if (hasTieredReception || flatReception === undefined) {
    limitations.push(
      "This league scores receptions by yardage tier, which Summit can't represent — " +
        `reception points default to Summit's standard PPR value (${DEFAULT_SCORING_SETTINGS.reception} pt/reception).`,
    );
  } else {
    reception = flatReception;
  }

  // Kicker/IDP scoring limitations are reported by mapSleeperRosterPositions instead,
  // keyed off the league's actual roster slots — a more reliable signal than scattered
  // scoring-table keys, and avoids reporting the same limitation twice.

  const scoring: ScoringSettings = {
    passingTd: num("pass_td") ?? DEFAULT_SCORING_SETTINGS.passingTd,
    passingYardsPerPoint: num("pass_yd") ?? DEFAULT_SCORING_SETTINGS.passingYardsPerPoint,
    interception: num("pass_int") ?? DEFAULT_SCORING_SETTINGS.interception,
    rushingTd: num("rush_td") ?? DEFAULT_SCORING_SETTINGS.rushingTd,
    rushingYardsPerPoint: num("rush_yd") ?? DEFAULT_SCORING_SETTINGS.rushingYardsPerPoint,
    receivingTd: num("rec_td") ?? DEFAULT_SCORING_SETTINGS.receivingTd,
    receivingYardsPerPoint: num("rec_yd") ?? DEFAULT_SCORING_SETTINGS.receivingYardsPerPoint,
    reception,
    fumbleLost: num("fum_lost") ?? DEFAULT_SCORING_SETTINGS.fumbleLost,
  };

  return { scoring, limitations };
}

export function mapSleeperRosterPositions(
  positions: string[],
): { roster: RosterSettings; limitations: string[] } {
  const limitations: string[] = [];
  const count = (label: string) => positions.filter((p) => p === label).length;

  const irTaxiCount = count("IR") + count("TAXI");
  if (irTaxiCount > 0) {
    limitations.push(
      `This league has ${irTaxiCount} IR/Taxi slot(s) — Summit has no separate IR/Taxi concept, so those are folded into bench slots.`,
    );
  }

  const roster: RosterSettings = {
    QB: count("QB"),
    RB: count("RB"),
    WR: count("WR"),
    TE: count("TE"),
    FLEX: count("FLEX"),
    SUPERFLEX: count("SUPER_FLEX"),
    DEF: count("DEF"),
    K: count("K"),
    BENCH: count("BN") + irTaxiCount,
  };

  if (roster.DEF > 0) {
    limitations.push(
      "This league starts a team defense — nflverse has no team-defense weekly stats, so defenses will always score 0 in Summit.",
    );
  }
  if (roster.K > 0) {
    limitations.push(
      "This league starts a kicker — nflverse has no kicker weekly stats, so kickers will always score 0 in Summit.",
    );
  }

  return { roster, limitations };
}
