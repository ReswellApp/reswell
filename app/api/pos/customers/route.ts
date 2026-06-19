import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { storeCustomerCaptureSchema } from "@/lib/validations/consignment"
import { captureStoreCustomer } from "@/lib/services/storeCustomers"

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

  const result = await captureStoreCustomer(user.id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: { customerId: result.customerId } }, { status: 201 })
}
