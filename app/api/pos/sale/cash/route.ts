import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { completePosCashSale } from "@/lib/services/posSale"
import { signPosReceiptToken } from "@/lib/services/posReceiptToken"
import { posCashSaleSchema } from "@/lib/validations/consignment"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = posCashSaleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await completePosCashSale(user.id, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({
    data: {
      orderId: result.orderId,
      receiptToken: signPosReceiptToken(result.orderId),
      receiptEmailSent: result.receiptEmailSent ?? false,
      customerEmail: result.customerEmail ?? null,
    },
  })
}
