import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { CreateLeagueForm } from "./create-league-form";

export default async function NewLeaguePage() {
  await requireUser();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Link
        href="/leagues"
        className="self-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← My Leagues
      </Link>
      <CreateLeagueForm />
    </div>
  );
}
