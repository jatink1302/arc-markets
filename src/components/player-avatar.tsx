"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

export function PlayerAvatar({
  headshotUrl,
  name,
  className,
}: {
  headshotUrl: string | null;
  name: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!headshotUrl || errored) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-muted-foreground",
          className,
        )}
      >
        {initials(name)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external CDN, not worth next/image config for a demo
    <img
      src={headshotUrl}
      alt=""
      loading="lazy"
      onError={() => setErrored(true)}
      className={cn("shrink-0 rounded-full bg-secondary object-cover", className)}
    />
  );
}
