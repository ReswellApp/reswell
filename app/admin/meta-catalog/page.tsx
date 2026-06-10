import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { buildMetaCatalogInsights } from "@/lib/services/metaCatalogInsights"
import { MetaCatalogDashboardClient } from "@/components/features/admin/meta-catalog-dashboard-client"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Meta Catalog — Admin — Reswell",
  description:
    "Live Meta Commerce catalog feed health, product review status, item-level issues, Advantage+ catalog ad performance, and Pixel/CAPI status.",
  path: "/admin/meta-catalog",
})

const DEFAULT_RANGE_DAYS = 28

export default async function AdminMetaCatalogPage() {
  const supabase = await createClient()
  const insights = await buildMetaCatalogInsights(supabase, { days: DEFAULT_RANGE_DAYS })

  return <MetaCatalogDashboardClient initialInsights={insights} />
}
