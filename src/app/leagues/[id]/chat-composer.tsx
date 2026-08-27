"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendChatMessage } from "@/app/actions/fantasy-chat";

export function ChatComposer({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = value;
    if (!body.trim() || isPending) return;
    startTransition(async () => {
      const result = await sendChatMessage(leagueId, body);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setValue("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Message the league…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isPending}
      />
      <Button type="submit" disabled={isPending || !value.trim()} className="shrink-0">
        {isPending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
