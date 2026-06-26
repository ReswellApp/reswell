import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { startAdminTerminalSale } from "@/lib/services/adminTerminalSale"
import { adminTerminalSaleStartSchema } from "@/lib/validations/adminTerminalSale"

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

  const parsed = adminTerminalSaleStartSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    )
  }

  const result = await startAdminTerminalSale(gate.ctx.user.id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(
    {
      data: {
        paymentIntentId: result.paymentIntentId,
        readerId: result.readerId,
        amountUsd: result.amountUsd,
      },
    },
    { status: 201 },
  )
}
