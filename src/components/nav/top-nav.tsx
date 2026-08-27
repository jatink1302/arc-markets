import Image from "next/image";
import { NavLinks } from "@/components/nav/nav-links";
import { SettingsSheet } from "@/components/settings/settings-sheet";
import { BalanceDisplay } from "@/components/nav/balance-display";

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
          <span className="flex items-center gap-1.5">
            <Image src="/summit-icon.png" alt="" width={28} height={11} className="h-5 w-auto" />
            <span className="font-heading text-lg uppercase tracking-wider text-foreground">
              Summit
            </span>
          </span>
          <span className="hidden rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground sm:inline">
            {leagueName ?? "No league connected"}
          </span>
        </div>
        <div className="hidden md:flex">
          <NavLinks />
        </div>
        <div className="text-right">
          <BalanceDisplay balance={balance} />
        </div>
      </div>
    </header>
  );
}
