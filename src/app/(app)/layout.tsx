import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/ledger";
import { TopNav } from "@/components/nav/top-nav";
import { BottomNav } from "@/components/nav/bottom-nav";
import { AutoRefresh } from "@/components/auto-refresh";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authUser = await requireUser();

  const [user, balance] = await Promise.all([
    prisma.user.findUnique({
      where: { id: authUser.id },
      include: { activeLeague: true },
    }),
    getBalance(authUser.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <AutoRefresh intervalMs={12_000} />
      <TopNav
        leagueName={user?.activeLeague?.name ?? null}
        balance={balance}
        email={authUser.email ?? ""}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-20 md:pb-6">{children}</main>
      <BottomNav />
    </div>
  );
}
