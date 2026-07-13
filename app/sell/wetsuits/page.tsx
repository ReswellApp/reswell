import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { actorCanManageWetsuitListings } from "@/lib/services/wetsuitListingSeller"
import SellWetsuitsFlow from "./sell-wetsuits-client"

export const metadata: Metadata = privatePageMetadata({
  title: "List a wetsuit — Reswell",
  description: "List wetsuits for sale on Reswell.",
  path: "/sell/wetsuits",
})

function parseEditListingId(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === "string" && first.trim()) return first.trim()
  }
  return null
}

export default async function SellWetsuitsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth/login?redirect=/sell/wetsuits")
  }
  const allowed = await actorCanManageWetsuitListings(supabase, user.id)
  if (!allowed) {
    redirect("/wetsuits")
  }

  const qs = await searchParams
  const editId = parseEditListingId(qs.edit)
  return <SellWetsuitsFlow editListingId={editId} />
}
