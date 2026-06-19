import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getConsignmentStoreBySlug,
  getStoreStaffRole,
  listActiveStoreInventory,
} from "@/lib/db/consignmentStores"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const slug = request.nextUrl.searchParams.get("store")?.trim()
  const query = request.nextUrl.searchParams.get("q") ?? undefined
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

  const inventory = await listActiveStoreInventory(supabase, store.id, query)
  return NextResponse.json({ data: { inventory } })
}
