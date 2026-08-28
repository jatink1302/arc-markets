import { redirect } from "next/navigation";

// Superseded by the home page (src/app/page.tsx), which renders this same content —
// kept as a redirect so every existing "/leagues" link (settings sheet, back-links
// across league sub-pages) keeps working without needing to be rewired.
export default function LeaguesPage() {
  redirect("/");
}
