"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Avoid a hydration mismatch — theme is only known client-side after mount.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard next-themes mount guard
  useEffect(() => setMounted(true), []);

  const options = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={cn(
            "flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
            mounted && theme === opt.value
              ? "border-primary bg-primary/20 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
