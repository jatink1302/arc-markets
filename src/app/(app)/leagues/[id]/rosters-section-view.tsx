"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold text-primary-foreground">
      {count}
    </span>
  );
}

export function RostersSectionView({
  myTeamSlot,
  rostersSlot,
  freeAgentsSlot,
  tradesSlot,
  pendingTradesCount,
}: {
  myTeamSlot: React.ReactNode;
  rostersSlot: React.ReactNode;
  freeAgentsSlot: React.ReactNode;
  tradesSlot: React.ReactNode;
  pendingTradesCount: number;
}) {
  return (
    <Tabs defaultValue="myTeam" className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="myTeam" className="shrink-0 grow-0">
          My Team
        </TabsTrigger>
        <TabsTrigger value="rosters" className="shrink-0 grow-0">
          Rosters
        </TabsTrigger>
        <TabsTrigger value="freeAgents" className="shrink-0 grow-0">
          Free Agents
        </TabsTrigger>
        <TabsTrigger value="trades" className="shrink-0 grow-0">
          Trades
          <CountBadge count={pendingTradesCount} />
        </TabsTrigger>
      </TabsList>
      <TabsContent value="myTeam" className="mt-4">
        {myTeamSlot}
      </TabsContent>
      <TabsContent value="rosters" className="mt-4">
        {rostersSlot}
      </TabsContent>
      <TabsContent value="freeAgents" className="mt-4">
        {freeAgentsSlot}
      </TabsContent>
      <TabsContent value="trades" className="mt-4">
        {tradesSlot}
      </TabsContent>
    </Tabs>
  );
}
