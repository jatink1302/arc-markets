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

export function SeasonView({
  matchupSlot,
  standingsSlot,
  rostersSlot,
  activitySlot,
  pendingTradesCount,
}: {
  matchupSlot: React.ReactNode;
  standingsSlot: React.ReactNode;
  rostersSlot: React.ReactNode;
  activitySlot: React.ReactNode;
  pendingTradesCount: number;
}) {
  return (
    <Tabs defaultValue="rosters" className="w-full max-w-2xl">
      <TabsList className="w-full">
        <TabsTrigger value="rosters" className="flex-1">
          Rosters
          <CountBadge count={pendingTradesCount} />
        </TabsTrigger>
        <TabsTrigger value="matchup" className="flex-1">
          Matchup
        </TabsTrigger>
        <TabsTrigger value="standings" className="flex-1">
          Standings
        </TabsTrigger>
        <TabsTrigger value="activity" className="flex-1">
          Activity
        </TabsTrigger>
      </TabsList>
      <TabsContent value="rosters" className="mt-4">
        {rostersSlot}
      </TabsContent>
      <TabsContent value="matchup" className="mt-4">
        {matchupSlot}
      </TabsContent>
      <TabsContent value="standings" className="mt-4">
        {standingsSlot}
      </TabsContent>
      <TabsContent value="activity" className="mt-4">
        {activitySlot}
      </TabsContent>
    </Tabs>
  );
}
