import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { completeAdminTerminalCashSale } from "@/lib/services/adminTerminalSale"
import { adminTerminalSaleCashSchema } from "@/lib/validations/adminTerminalSale"

/** POST /api/admin/terminal/sale/cash — record in-person cash and settle the marketplace order. */
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

  const parsed = adminTerminalSaleCashSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    )
  }

  const result = await completeAdminTerminalCashSale(gate.ctx.user.id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(
    {
      data: {
        orderId: result.orderId,
        alreadyProcessed: result.alreadyProcessed ?? false,
      },
    },
    { status: 201 },
  )
}
