import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SellCatalogImageScan } from "@/components/features/sell/sell-catalog-image-scan"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { SELL_CATALOG_IMAGE_SCAN_HREF } from "@/lib/types/sell-catalog-image-scan"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "Scan a photo — Sell — Reswell",
  description: "Admin-only photo matcher for surfboards and fins.",
  robots: { index: false, follow: false },
  alternates: { canonical: SELL_CATALOG_IMAGE_SCAN_HREF },
}

export default async function SellCatalogImageScanPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/sell")
  }

  const isAdmin = await fetchProfileIsAdmin(supabase, user.id)
  if (!isAdmin) {
    redirect("/sell")
  }

  return <SellCatalogImageScan />
}
