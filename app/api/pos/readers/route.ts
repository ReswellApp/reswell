import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getConsignmentStoreBySlug, getStoreStaffRole } from "@/lib/db/consignmentStores"
import { listTerminalReadersForLocation } from "@/lib/services/stripeTerminal"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const slug = request.nextUrl.searchParams.get("store")?.trim()
  if (!slug) {
    return NextResponse.json({ error: "Missing store" }, { status: 400 })
  }

  const store = await getConsignmentStoreBySlug(supabase, slug)
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 })
  }

  const role = await getStoreStaffRole(supabase, store.id, user.id)
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!store.stripeTerminalLocationId) {
    return NextResponse.json(
      { error: "No Terminal location configured for this store." },
      { status: 409 },
    )
  }

  try {
    const readers = await listTerminalReadersForLocation(store.stripeTerminalLocationId)
    return NextResponse.json({ data: { readers } })
  } catch (e) {
    console.error("[api/pos/readers] list failed", e)
    return NextResponse.json({ error: "Could not load readers." }, { status: 502 })
  }
}
