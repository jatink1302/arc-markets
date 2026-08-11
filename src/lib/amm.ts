// Simplified single-sided bonding-curve market maker.
//
// price(supply) = basePrice + slope * supply
//
// "supply" is net contracts outstanding across all users for a player. Buying moves
// supply up (and price up with it); selling moves supply down. There is no naked
// shorting — a sell can never take supply below 0, which callers enforce by never
// letting a user sell more than their own held position.
//
// Cost/proceeds are the area under the (linear) price curve between the start and
// end supply — i.e. the integral, not supply * a single price point — so a large
// order pays a fair average price across the move it causes, the same way a real
// AMM would. All amounts are plain JS numbers (this is a play-money MVP, not a
// cents-exact ledger), rounded to 4dp before being handed to Prisma's Decimal columns.

export type CurveParams = {
  basePrice: number;
  slope: number;
  supply: number;
};

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export function priceAt({ basePrice, slope, supply }: CurveParams): number {
  return round4(basePrice + slope * supply);
}

export type TradeQuote = {
  amount: number; // cost (buy) or proceeds (sell), always positive
  avgPrice: number;
  priceAfter: number;
};

export function quoteBuy(curve: CurveParams, quantity: number): TradeQuote {
  if (quantity <= 0) throw new Error("quantity must be positive");
  const { basePrice, slope, supply } = curve;
  const supplyAfter = supply + quantity;
  // integral of (basePrice + slope*s) ds from supply to supplyAfter
  const cost = quantity * basePrice + slope * quantity * (supply + supplyAfter) / 2;
  return {
    amount: round4(cost),
    avgPrice: round4(cost / quantity),
    priceAfter: priceAt({ basePrice, slope, supply: supplyAfter }),
  };
}

export function quoteSell(curve: CurveParams, quantity: number): TradeQuote {
  if (quantity <= 0) throw new Error("quantity must be positive");
  const { basePrice, slope, supply } = curve;
  if (quantity > supply) {
    throw new Error("quantity exceeds outstanding supply");
  }
  const supplyAfter = supply - quantity;
  const proceeds = quantity * basePrice + slope * quantity * (supply + supplyAfter) / 2;
  return {
    amount: round4(proceeds),
    avgPrice: round4(proceeds / quantity),
    priceAfter: priceAt({ basePrice, slope, supply: supplyAfter }),
  };
}
