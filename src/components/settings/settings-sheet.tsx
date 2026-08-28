"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/settings/theme-toggle";
import { SetPasswordForm } from "@/components/settings/set-password-form";
import { SignOutButton } from "@/components/nav/sign-out-button";

export function SettingsSheet({
  leagueName,
  email,
}: {
  leagueName: string | null;
  email: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Settings" />}>
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col bg-background/55">
        <SheetHeader>
          <SheetTitle className="font-heading text-lg uppercase tracking-wide">
            Settings
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          <section className="flex flex-col gap-2">
            <h3 className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
              Appearance
            </h3>
            <ThemeToggle />
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
              Leagues
            </h3>
            <Link
              href="/leagues"
              onClick={() => setOpen(false)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              My leagues
            </Link>
            <div className="flex gap-2">
              <Link
                href="/leagues/new"
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1" })}
              >
                Start a league
              </Link>
              <Link
                href="/leagues/join"
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "outline", size: "sm", className: "flex-1" })}
              >
                Join a league
              </Link>
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
              Sleeper league
            </h3>
            <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
              <span className="text-sm text-foreground">
                {leagueName ?? "No league connected"}
              </span>
              <Link
                href="/onboarding"
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {leagueName ? "Change" : "Connect"}
              </Link>
            </div>
          </section>

          <Separator />

          <section className="flex flex-col gap-2">
            <h3 className="font-heading text-xs uppercase tracking-wide text-muted-foreground">
              Account
            </h3>
            <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5">
              <span className="truncate text-sm text-foreground">{email}</span>
              <SignOutButton />
            </div>
            <SetPasswordForm />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
