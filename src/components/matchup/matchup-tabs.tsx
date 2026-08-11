"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function MatchupTabs({
  defaultTab = "matchup",
  matchupSlot,
  teamSlot,
  leagueSlot,
  leadersSlot,
}: {
  defaultTab?: "matchup" | "team" | "league" | "leaders";
  matchupSlot: React.ReactNode;
  teamSlot: React.ReactNode;
  leagueSlot: React.ReactNode;
  leadersSlot: React.ReactNode;
}) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="w-full">
        <TabsTrigger value="matchup" className="flex-1">
          Matchup
        </TabsTrigger>
        <TabsTrigger value="team" className="flex-1">
          Team
        </TabsTrigger>
        <TabsTrigger value="league" className="flex-1">
          League
        </TabsTrigger>
        <TabsTrigger value="leaders" className="flex-1">
          Leaders
        </TabsTrigger>
      </TabsList>
      <TabsContent value="matchup" className="mt-4">
        {matchupSlot}
      </TabsContent>
      <TabsContent value="team" className="mt-4">
        {teamSlot}
      </TabsContent>
      <TabsContent value="league" className="mt-4">
        {leagueSlot}
      </TabsContent>
      <TabsContent value="leaders" className="mt-4">
        {leadersSlot}
      </TabsContent>
    </Tabs>
  );
}
