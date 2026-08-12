import { IntelligenceAdminClient } from "@/components/features/admin/intelligence-admin-client"
import { loadIntelligenceDashboard } from "@/lib/services/businessIntelligence"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export const metadata = privatePageMetadata({
  title: "Intelligence — Admin — Reswell",
  description:
    "Daily Gemini operating briefing first, then live GMV, users, listings, orders, top URLs, and saved weekly / monthly reports.",
  path: "/admin/intelligence",
})

export default async function AdminIntelligencePage() {
  const initial = await loadIntelligenceDashboard()
  return <IntelligenceAdminClient initial={initial} />
}
