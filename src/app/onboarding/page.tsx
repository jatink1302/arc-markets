import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { OnboardingFlow } from "./onboarding-flow";

export default async function OnboardingPage() {
  await requireUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <Link
        href="/matchup"
        className="self-center text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back
      </Link>
      <OnboardingFlow />
    </main>
  );
}
