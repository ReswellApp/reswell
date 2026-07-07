import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { actorCanManageMagazineListings } from "@/lib/services/magazineListingSeller"
import SellMagazinesFlow from "./sell-magazines-client"

export const metadata: Metadata = privatePageMetadata({
  title: "List a magazine — Reswell",
  description: "List surf magazines for sale on Reswell.",
  path: "/sell/magazines",
})

function parseEditListingId(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === "string" && first.trim()) return first.trim()
  }
  return null
}

export default async function SellMagazinesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/sell/magazines")
  }
  const allowed = await actorCanManageMagazineListings(supabase, user.id)
  if (!allowed) {
    redirect("/magazines")
  }

  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return <SellMagazinesFlow editListingId={editId} />
}
