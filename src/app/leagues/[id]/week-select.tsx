"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function WeekSelect({
  leagueId,
  week,
  seasonWeeks,
}: {
  leagueId: string;
  week: number;
  seasonWeeks: number;
}) {
  const router = useRouter();
  const weeks = Array.from({ length: seasonWeeks }, (_, i) => i + 1);

  return (
    <Select
      value={String(week)}
      onValueChange={(value) => router.push(`/leagues/${leagueId}?week=${value}`)}
    >
      <SelectTrigger className="w-full">
        <SelectValue>Week {week}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {weeks.map((w) => (
          <SelectItem key={w} value={String(w)}>
            Week {w}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
