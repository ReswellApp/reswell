import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/brands/admin-server"
import { startAdminTerminalCardCheckout } from "@/lib/services/adminTerminalSale"
import { adminTerminalSaleCheckoutSchema } from "@/lib/validations/adminTerminalSale"

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

  const parsed = adminTerminalSaleCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    )
  }

  const result = await startAdminTerminalCardCheckout(gate.ctx.user.id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(
    {
      data: {
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret,
        amountUsd: result.amountUsd,
      },
    },
    { status: 201 },
  )
}
