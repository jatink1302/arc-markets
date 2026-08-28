import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Lineup slot labels get their own small, fixed-width pill between two players' rows in a
// paired-starter row — long ones (SUPER_FLEX) need shortening or they blow out the column
// on narrow screens. Shared by the Sleeper-linked and native-league matchup views.
// SUPER_FLEX is Sleeper's own naming (System 1); SUPERFLEX (no underscore) is this app's
// native RosterSettings key — both abbreviate the same way.
const SHORT_SLOT: Record<string, string> = { SUPER_FLEX: "SFLX", SUPERFLEX: "SFLX" }
export function shortSlot(slot: string): string {
  return SHORT_SLOT[slot] ?? slot
}
