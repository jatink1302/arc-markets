import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function NoLeagueCard({ what }: { what: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-24 text-center">
      <p className="text-sm font-medium text-foreground">No league connected</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Connect your Sleeper league to see {what}.
      </p>
      <Link href="/onboarding" className={buttonVariants({ variant: "default", size: "sm" })}>
        Connect a league
      </Link>
    </div>
  );
}
