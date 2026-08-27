"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ensureSeeded } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

type Mode = "login" | "signup" | "reset";

const DESCRIPTIONS: Record<Mode, string> = {
  login: "Welcome back.",
  signup: "Create your account.",
  reset: "Reset your password.",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
        setStatus("idle");
        return;
      }
      setStatus("sent");
      return;
    }

    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }

    if (data.session) {
      // Signed in immediately — either a login, or a signup with email confirmation
      // disabled on this Supabase project. No email involved at all.
      await ensureSeeded();
      router.replace("/");
      router.refresh();
      return;
    }

    // Signup succeeded but needs email confirmation before a session exists.
    setStatus("sent");
  }

  function handleModeChange(next: string) {
    setMode(next as Mode);
    setStatus("idle");
    setError(null);
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
          <CardDescription className="text-center">{DESCRIPTIONS[mode]}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {mode === "reset" ? (
            <button
              type="button"
              onClick={() => handleModeChange("login")}
              className="self-start text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to log in
            </button>
          ) : (
            <Tabs value={mode} onValueChange={handleModeChange}>
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1">
                  Log in
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Sign up
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {status === "sent" ? (
            <p className="text-sm text-muted-foreground">
              {mode === "reset" ? (
                <>
                  Check <span className="text-foreground">{email}</span> for a link to reset your
                  password.
                </>
              ) : (
                <>
                  Check <span className="text-foreground">{email}</span> for a confirmation link
                  to finish creating your account.
                </>
              )}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {mode !== "reset" && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => handleModeChange("reset")}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={mode === "signup" ? 6 : undefined}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
              {error && <p className="text-sm text-negative">{error}</p>}
              <Button type="submit" disabled={status === "sending"} className="w-full">
                {status === "sending"
                  ? "Please wait…"
                  : mode === "login"
                    ? "Log in"
                    : mode === "signup"
                      ? "Create account"
                      : "Send reset link"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
