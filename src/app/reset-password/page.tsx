"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

// The recovery link's tokens arrive either as a URL hash fragment (never seen by the
// server) or a PKCE `code` — either way, the Supabase browser client parses them into a
// real session automatically as soon as it's constructed (detectSessionInUrl, on by
// default). We just have to wait for that before the "set a new password" form is
// usable, since submitting it needs an authenticated session to already exist.
type SessionCheck = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [sessionCheck, setSessionCheck] = useState<SessionCheck>("checking");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setSessionCheck("ready");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionCheck("ready");
        return;
      }
      // No session yet on the very first check — give detectSessionInUrl a moment to
      // finish parsing the link before concluding it's invalid or expired.
      setTimeout(() => {
        supabase.auth.getSession().then(({ data }) => {
          setSessionCheck((current) => (current === "ready" ? current : data.session ? "ready" : "invalid"));
        });
      }, 1500);
    });

    return () => subscription.unsubscribe();
  }, []);

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

    router.replace("/matchup");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <Image
        src="/summit-lockup.png"
        alt="Summit"
        width={1126}
        height={636}
        priority
        className="h-auto w-[min(220px,55vw)]"
      />
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader>
          <CardDescription className="text-center">Choose a new password.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionCheck === "checking" && (
            <p className="text-center text-sm text-muted-foreground">Verifying your link…</p>
          )}
          {sessionCheck === "invalid" && (
            <p className="text-center text-sm text-negative">
              This reset link is invalid or has expired. Request a new one from the login page.
            </p>
          )}
          {sessionCheck === "ready" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoFocus
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-negative">{error}</p>}
              <Button type="submit" disabled={status === "saving"} className="w-full">
                {status === "saving" ? "Saving…" : "Set new password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
