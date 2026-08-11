"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Polls the server for fresh data by re-running the current route's server components. */
export function AutoRefresh({ intervalMs = 12_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
