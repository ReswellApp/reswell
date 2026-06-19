import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { refundConsignmentOrder } from "@/lib/services/refundConsignmentOrder"

const paramsSchema = z.object({ id: z.string().uuid() })

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = paramsSchema.safeParse(await params)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await refundConsignmentOrder({
    staffProfileId: user.id,
    orderId: parsed.data.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ data: { pending: result.pending, message: result.message } })
}
