import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export default async function RootPage() {
  await requireUser();
  redirect("/matchup");
}
