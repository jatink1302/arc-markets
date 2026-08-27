"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function BalanceDisplay({ balance }: { balance: number }) {
  const [flip, setFlip] = useState(false);
  const prev = useRef(balance);

  useEffect(() => {
    if (prev.current === balance) return;
    prev.current = balance;
    setFlip(true);
    const timer = setTimeout(() => setFlip(false), 400);
    return () => clearTimeout(timer);
  }, [balance]);

  return (
    <div
      className={cn(
        "font-mono text-sm font-medium text-positive",
        flip && "animate-score-flip",
      )}
    >
      ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  );
}
