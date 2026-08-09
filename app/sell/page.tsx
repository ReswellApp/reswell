import { Suspense } from "react"
import { redirect } from "next/navigation"
import { SellStart } from "@/components/features/sell/sell-start"
import type { SellTrendingBrand } from "@/components/features/sell/sell-trending-brands"
import { getCachedHomeStableCatalog } from "@/lib/cache/home-public-catalog"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { createClient } from "@/lib/supabase/server"
import SellFlowShell from "./sell-flow-client"

function parseEditListingId(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === "string" && first.trim()) return first.trim()
  }
  return null
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value[0]
  return undefined
}

export default async function SellPage({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string | string[]
    new?: string | string[]
    type?: string | string[]
    choose?: string | string[]
  }>
}) {
  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  const type = firstParam(qs.type)
  const chooseSurfboard = firstParam(qs.choose) === "surfboard"

  // Legacy Quick vs Full entry — send straight to the full wizard.
  if (chooseSurfboard && !editId && type !== "surfboard") {
    redirect("/sell/boards?new=1")
  }

  // Editing an existing listing or explicitly choosing surfboards goes straight
  // to the surfboard flow (/sell/boards is the canonical boards sell URL).
  // Suspense fallback is null: the client form owns its own editLoading skeleton,
  // and a route-level skeleton was flashing on every `?edit=` draft switch.
  if (editId || type === "surfboard") {
    return (
      <Suspense fallback={null}>
        <SellFlowShell urlEditListingId={editId} />
      </Suspense>
    )
  }

  const supabase = await createClient()
  const [{ data: userData }, homeCatalog] = await Promise.all([
    supabase.auth.getUser(),
    // Same cached curation as the homepage "Trending brands" strip.
    getCachedHomeStableCatalog(),
  ])
  const user = userData.user
  const isAdmin = user ? await fetchProfileIsAdmin(supabase, user.id) : false

  const trendingBrands: SellTrendingBrand[] = homeCatalog.homeTrendingBrandRows.map(
    (row) => ({
      id: row.brand.id,
      slug: row.brand.slug,
      name: row.brand.name,
      logoUrl: row.brand.logo_url,
    }),
  )

  // `/sell` and `/sell?new=1` land on catalog search (+ compact type links).
  return <SellStart isAdmin={isAdmin} trendingBrands={trendingBrands} />
}
