import type { Metadata } from "next"
import { SiteClosureScreen } from "@/components/features/site-closure/site-closure-screen"
import { SITE_CLOSURE_DATE_LABEL } from "@/lib/site-closure"

/**
 * Anonymous shutdown page. No session lookup: public URLs rewrite here, and a
 * dynamic render was invoking a function plus Supabase on every crawler hit.
 * Signed-in people still reach earnings through the login link, which skips
 * the form when a session already exists.
 */
export const dynamic = "force-static"
export const revalidate = 3600

export const metadata: Metadata = {
  title: "Reswell has closed",
  description: `As of ${SITE_CLOSURE_DATE_LABEL}, Reswell has shut down. Sign in to view your earnings, purchases, and sales.`,
  robots: { index: false, follow: false },
}

export default function SiteClosurePage() {
  return <SiteClosureScreen account={null} />
}
