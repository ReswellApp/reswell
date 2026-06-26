import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { cancelAdminTerminalSale } from "@/lib/services/adminTerminalSale"
import { adminTerminalSaleCancelSchema } from "@/lib/validations/adminTerminalSale"

export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (!gate.ok) {
    return gate.response
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = adminTerminalSaleCancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await cancelAdminTerminalSale(
    parsed.data.paymentIntentId,
    parsed.data.readerId,
  )
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: { canceled: true } })
}
