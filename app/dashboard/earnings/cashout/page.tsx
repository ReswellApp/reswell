import { permanentRedirect } from "next/navigation"

/** Legacy route; bank cashout UI was removed — HTTP redirect for crawlers and instant handoff. */
export default function CashoutRedirectPage() {
  permanentRedirect("/dashboard/earnings")
}
