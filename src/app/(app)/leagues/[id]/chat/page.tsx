import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AutoRefresh } from "@/components/auto-refresh";
import { TeamAvatar } from "@/components/matchup/team-avatar";
import { resolveNativeMemberLogoUrls } from "@/lib/roster";
import { ChatComposer } from "../chat-composer";

function formatTime(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function LeagueChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authUser = await requireUser();

  const league = await prisma.fantasyLeague.findUnique({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, email: true } } } },
      chatMessages: {
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { member: { include: { user: { select: { email: true } } } } },
      },
    },
  });
  if (!league) notFound();

  const me = league.members.find((m) => m.userId === authUser.id);
  if (!me) redirect("/leagues/join");

  const logoUrlByMember = await resolveNativeMemberLogoUrls(
    league.members.map((m) => ({ id: m.id, sleeperRosterId: m.sleeperRosterId })),
    league.sourceSleeperLeagueId,
  );

  const messages = [...league.chatMessages].reverse();

  return (
    <div className="flex flex-col items-center gap-4">
      <AutoRefresh intervalMs={5_000} />

      <Link
        href={`/leagues/${id}`}
        className="self-start text-sm text-muted-foreground hover:text-foreground"
      >
        ← {league.name}
      </Link>

      <div className="flex w-full max-w-2xl flex-col gap-4">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
          League Chat
        </h1>

        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No messages yet — say hi.
            </p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.memberId === me.id;
              const senderName = msg.member.teamName ?? msg.member.user?.email ?? "Unclaimed Team";
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
                >
                  {!isMine && (
                    <TeamAvatar
                      sleeperRosterId={null}
                      name={senderName}
                      logoUrl={logoUrlByMember.get(msg.memberId) ?? null}
                      accent="positive"
                      size="sm"
                    />
                  )}
                  <div className={`flex max-w-[75%] flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}>
                    <div
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        isMine
                          ? "border-primary/30 bg-primary/15 text-foreground"
                          : "border-border bg-card text-foreground"
                      }`}
                    >
                      {!isMine && (
                        <div className="mb-0.5 font-display text-xs tracking-wide text-positive">
                          {senderName}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{msg.body}</div>
                    </div>
                    <span className="px-1 font-mono text-[0.65rem] text-muted-foreground">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <ChatComposer leagueId={league.id} />
      </div>
    </div>
  );
}
