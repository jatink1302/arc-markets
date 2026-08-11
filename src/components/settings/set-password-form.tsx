"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Sets/changes the password for the currently-authenticated session — no email involved
// at all. Useful both for password-less accounts (e.g. created via a magic link or a
// recovery-link session) picking a password for the first time, and for changing one later.
export function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    setPassword("");
    setStatus("saved");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Input
        type="password"
        required
        minLength={6}
        placeholder="New password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setStatus("idle");
        }}
      />
      {error && <p className="text-xs text-negative">{error}</p>}
      {status === "saved" && <p className="text-xs text-positive">Password set.</p>}
      <Button type="submit" size="sm" disabled={status === "saving"} className="self-start">
        {status === "saving" ? "Saving…" : "Set password"}
      </Button>
    </form>
  );
}
