import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { respondToStoreOffer } from "@/lib/services/respondToStoreOffer"
import { respondToOfferSchema } from "@/lib/validations/respond-to-offer"

const bodySchema = z.object({
  storeId: z.string().uuid(),
  offer: respondToOfferSchema,
})

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

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const result = await respondToStoreOffer({
    staffProfileId: user.id,
    storeId: parsed.data.storeId,
    offer: parsed.data.offer,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: { conversationId: result.conversationId } })
}
