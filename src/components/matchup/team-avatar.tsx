"use client";

import { useRef, useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadTeamLogo } from "@/app/actions/team-logo";

const ACCENT = {
  positive: { border: "border-positive", text: "text-positive" },
  negative: { border: "border-negative", text: "text-negative" },
} as const;

export function TeamAvatar({
  sleeperRosterId,
  name,
  logoUrl,
  accent,
  size = "lg",
  uploadable = false,
}: {
  sleeperRosterId: number;
  name: string;
  logoUrl: string | null;
  accent: "positive" | "negative";
  size?: "sm" | "lg";
  uploadable?: boolean;
}) {
  const [errored, setErrored] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const letter = name.trim()[0]?.toUpperCase() ?? "?";
  const dims = size === "lg" ? "h-[130px] w-[130px] text-5xl" : "h-11 w-11 text-lg";
  const accentClasses = ACCENT[accent];
  const showImage = !!logoUrl && !errored;

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const result = await uploadTeamLogo(sleeperRosterId, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setErrored(false);
      toast.success("Logo updated.");
    });
  }

  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-2xl border-2 bg-card font-display",
          dims,
          accentClasses.border,
        )}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded or Sleeper-CDN image, not worth next/image config here
          <img
            src={logoUrl!}
            alt=""
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className={accentClasses.text}>{letter}</span>
        )}
      </div>
      {uploadable && (
        <>
          <button
            type="button"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground disabled:opacity-60"
            aria-label="Change team logo"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />
        </>
      )}
    </div>
  );
}
