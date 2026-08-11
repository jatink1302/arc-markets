// Pure snake-draft turn math — no server-only imports, safe to use from client components.

export function currentRound(pickNo: number, memberCount: number): number {
  return Math.floor(pickNo / memberCount); // 0-indexed
}

// Snake order: even rounds go forward through draftOrder, odd rounds go backward.
export function whoseTurnMemberId(draftOrder: string[], pickNo: number): string | null {
  const memberCount = draftOrder.length;
  if (memberCount === 0) return null;
  const round = currentRound(pickNo, memberCount);
  const indexInRound = pickNo % memberCount;
  const forward = round % 2 === 0;
  return forward ? draftOrder[indexInRound] : draftOrder[memberCount - 1 - indexInRound];
}
