"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendChatMessage } from "@/app/actions/fantasy-chat";

export function ChatComposer({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
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

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder="Message the league…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isPending}
      />
      <Button onClick={submit} disabled={isPending || !value.trim()} className="shrink-0">
        Send
      </Button>
    </div>
  );
}
