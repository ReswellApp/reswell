import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { APPAREL_SELL_ADMIN_ONLY } from "@/lib/apparel-listing-config"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import { createClient } from "@/lib/supabase/server"
import SellApparelFlow from "./sell-apparel-client"

const title = "Sell your apparel — Reswell"
const description =
  "List your apparel on Reswell in minutes: add photos, pick the category, set your price, and choose shipping or local pickup."

export const metadata: Metadata = {
  title,
  description,
  keywords: ["sell apparel", "list apparel", "used apparel", "Rip Curl apparel", "O'Neill apparel", "Reswell"],
  alternates: { canonical: "/sell/apparel" },
  openGraph: {
    title,
    description,
    url: "/sell/apparel",
    siteName: "Reswell",
    locale: "en_US",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
  // Soft-launch: sell flow is admin-only; keep out of public search indexes.
  robots: APPAREL_SELL_ADMIN_ONLY ? { index: false, follow: false } : undefined,
}

function parseEditListingId(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === "string" && first.trim()) return first.trim()
  }
  return null
}

export default async function SellApparelPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  if (APPAREL_SELL_ADMIN_ONLY) {
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
  }

  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return <SellApparelFlow editListingId={editId} />
}
