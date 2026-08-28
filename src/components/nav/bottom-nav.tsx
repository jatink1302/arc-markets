"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, TrendingUp, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/matchup", label: "Matchup", icon: House },
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/feed", label: "Feed", icon: FileText },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-10 md:hidden",
        "border-t border-white/15 bg-background/55 backdrop-blur-xl backdrop-saturate-150",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]",
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-around px-2 py-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md px-3 py-1 text-[11px] font-medium",
                active ? "text-positive" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
