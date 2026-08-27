import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ProposeTradeCard } from "./propose-trade-card";
import { DropPlayerButton } from "./drop-player-button";
import type { DraftMember, DraftPick } from "./draft-board";

export function LeagueRostersView({
  leagueId,
  myMemberId,
  members,
  picks,
}: {
  leagueId: string;
  myMemberId: string | null;
  members: DraftMember[];
  picks: DraftPick[];
}) {
  const picksByMember = new Map<string, DraftPick[]>();
  for (const pick of picks) {
    const list = picksByMember.get(pick.memberId) ?? [];
    list.push(pick);
    picksByMember.set(pick.memberId, list);
  }
  for (const list of picksByMember.values()) {
    list.sort((a, b) => a.pickNo - b.pickNo);
  }
  const myPicks = (myMemberId ? picksByMember.get(myMemberId) : undefined) ?? [];

  // Your own team always shows first — order was never meaningful otherwise (just
  // incidental joinedAt order).
  const orderedMembers =
    myMemberId
      ? [
          ...members.filter((m) => m.id === myMemberId),
          ...members.filter((m) => m.id !== myMemberId),
        ]
      : members;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {orderedMembers.map((member) => {
          const roster = picksByMember.get(member.id) ?? [];
          const isMine = member.id === myMemberId;
          return (
            <Card key={member.id} className="border-border bg-card">
              <CardHeader>
                <CardTitle className="font-heading text-sm uppercase tracking-wide text-foreground">
                  <Link href={`/leagues/${leagueId}/team/${member.id}`} className="hover:opacity-80">
                    {member.teamName ?? member.email ?? "Unclaimed Team"}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border/60 p-0">
                {roster.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No picks.</p>
                ) : (
                  roster.map((pick) => (
                    <div
                      key={pick.id}
                      className="flex items-center justify-between gap-3 px-4 py-2"
                    >
                      <span className="truncate text-sm text-foreground">{pick.playerName}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {pick.playerTeam ?? "FA"} · {pick.playerPosition}
                        </span>
                        {isMine && (
                          <DropPlayerButton
                            leagueId={leagueId}
                            pickId={pick.id}
                            playerName={pick.playerName}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
              {!isMine && myMemberId && (
                <CardFooter>
                  <ProposeTradeCard
                    mode="propose"
                    leagueId={leagueId}
                    theirMemberId={member.id}
                    myPicks={myPicks.map((p) => ({
                      id: p.id,
                      playerName: p.playerName,
                      playerPosition: p.playerPosition,
                    }))}
                    theirPicks={roster.map((p) => ({
                      id: p.id,
                      playerName: p.playerName,
                      playerPosition: p.playerPosition,
                    }))}
                  />
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
