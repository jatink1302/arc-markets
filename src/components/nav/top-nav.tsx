import { NavLinks } from "@/components/nav/nav-links";
import { SettingsSheet } from "@/components/settings/settings-sheet";

export function TopNav({
  leagueName,
  balance,
  email,
}: {
  leagueName: string | null;
  balance: number;
  email: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <SettingsSheet leagueName={leagueName} email={email} />
          <span className="font-heading text-lg uppercase tracking-wider text-foreground">
            Arc <span className="text-primary">Markets</span>
          </span>
          <span className="hidden rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground sm:inline">
            {leagueName ?? "No league connected"}
          </span>
        </div>
        <NavLinks />
        <div className="text-right">
          <div className="font-mono text-sm font-medium text-positive">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </header>
  );
}
