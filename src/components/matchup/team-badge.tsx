const COLORS = [
  "bg-emerald-950 text-emerald-400 border-emerald-800",
  "bg-blue-950 text-blue-400 border-blue-800",
  "bg-amber-950 text-amber-400 border-amber-800",
  "bg-rose-950 text-rose-400 border-rose-800",
  "bg-violet-950 text-violet-400 border-violet-800",
  "bg-cyan-950 text-cyan-400 border-cyan-800",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function TeamBadge({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const letter = name.trim()[0]?.toUpperCase() ?? "?";
  const dims = size === "sm" ? "h-8 w-8 text-sm" : "h-11 w-11 text-lg";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl border font-heading font-semibold ${dims} ${colorFor(name)}`}
    >
      {letter}
    </div>
  );
}
