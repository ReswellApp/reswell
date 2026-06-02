import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { BrandCatalogOverviewClient } from "@/components/features/admin/brand-catalog-overview-client"
import { getBrandCatalogOverview } from "@/lib/services/brandCatalogOverview"

export const metadata = privatePageMetadata({
  title: "Brand catalog explorer — Admin — Reswell",
  description:
    "Read-only hierarchy of brands, brand_models, and brand_model_variants stored in Supabase.",
  path: "/admin/catalog-overview",
})

export default async function AdminCatalogOverviewPage() {
  const supabase = await createClient()
  const { stats, nodes } = await getBrandCatalogOverview(supabase)

  return <BrandCatalogOverviewClient stats={stats} nodes={nodes} />
}
