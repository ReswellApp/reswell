import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { emailPosReceiptForOrder } from "@/lib/services/posReceiptEmail"
import { posEmailReceiptSchema } from "@/lib/validations/consignment"

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: orderId } = await ctx.params

  let body: unknown = {}
  try {
    const text = await request.text()
    if (text.trim()) body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = posEmailReceiptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    )
  }

  const customer =
    parsed.data.email && parsed.data.firstName
      ? {
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          email: parsed.data.email,
          phoneE164: parsed.data.phoneE164,
        }
      : undefined

  const result = await emailPosReceiptForOrder(user.id, orderId, customer)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: { customerEmail: result.customerEmail } })
}
