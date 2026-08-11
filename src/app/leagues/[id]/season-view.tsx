"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function SeasonView({
  matchupSlot,
  standingsSlot,
  rostersSlot,
  tradesSlot,
  freeAgentsSlot,
  activitySlot,
}: {
  matchupSlot: React.ReactNode;
  standingsSlot: React.ReactNode;
  rostersSlot: React.ReactNode;
  tradesSlot: React.ReactNode;
  freeAgentsSlot: React.ReactNode;
  activitySlot: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="matchup" className="w-full max-w-2xl">
      {/* Triggers don't truncate, so at 6 tabs a fixed-width flex-1 row would overflow/squish
          on phone widths — scroll horizontally instead of forcing everything to fit. */}
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="matchup" className="shrink-0 grow-0">
          Matchup
        </TabsTrigger>
        <TabsTrigger value="standings" className="shrink-0 grow-0">
          Standings
        </TabsTrigger>
        <TabsTrigger value="rosters" className="shrink-0 grow-0">
          Rosters
        </TabsTrigger>
        <TabsTrigger value="freeAgents" className="shrink-0 grow-0">
          Free Agents
        </TabsTrigger>
        <TabsTrigger value="trades" className="shrink-0 grow-0">
          Trades
        </TabsTrigger>
        <TabsTrigger value="activity" className="shrink-0 grow-0">
          Activity
        </TabsTrigger>
      </TabsList>
      <TabsContent value="matchup" className="mt-4">
        {matchupSlot}
      </TabsContent>
      <TabsContent value="standings" className="mt-4">
        {standingsSlot}
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
      <TabsContent value="activity" className="mt-4">
        {activitySlot}
      </TabsContent>
    </Tabs>
  );
}
