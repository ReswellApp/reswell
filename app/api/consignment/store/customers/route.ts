import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getConsignmentStoreBySlug,
  getStoreStaffRole,
  listStoreCustomers,
} from "@/lib/db/consignmentStores"
import { captureStoreCustomer } from "@/lib/services/storeCustomers"
import { storeCustomerCaptureSchema } from "@/lib/validations/consignment"

/** Shop staff: list this store's walk-in customers only (RLS + staff gate). */
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

  const customers = await listStoreCustomers(supabase, store.id)
  return NextResponse.json({ data: { customers } })
}

/** Shop staff: manually add/update a customer on this store's private list. */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = storeCustomerCaptureSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    )
  }

  const role = await getStoreStaffRole(supabase, parsed.data.storeId, user.id)
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const result = await captureStoreCustomer(user.id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: { customerId: result.customerId } }, { status: 201 })
}
