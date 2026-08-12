import { IntelligenceAdminClient } from "@/components/features/admin/intelligence-admin-client"
import { loadIntelligenceDashboard } from "@/lib/services/businessIntelligence"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export const metadata = privatePageMetadata({
  title: "Intelligence — Admin — Reswell",
  description:
    "Unified Reswell operating dashboard: GMV, users, listings, orders, top URLs, and saved daily, weekly, and monthly Gemini briefings.",
  path: "/admin/intelligence",
})

export default async function AdminIntelligencePage() {
  const initial = await loadIntelligenceDashboard()
  return <IntelligenceAdminClient initial={initial} />
}
