import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  withdrawConsignmentListing,
  recordOffPlatformSale,
} from "@/lib/services/consignmentLifecycle"

const paramsSchema = z.object({ id: z.string().uuid() })
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("withdraw") }),
  z.object({ action: z.literal("off_platform_sale"), salePrice: z.coerce.number().positive() }),
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsedParams = paramsSchema.safeParse(await params)
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
  }

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

  const result =
    parsed.data.action === "withdraw"
      ? await withdrawConsignmentListing({
          staffProfileId: user.id,
          listingId: parsedParams.data.id,
        })
      : await recordOffPlatformSale({
          staffProfileId: user.id,
          listingId: parsedParams.data.id,
          salePrice: parsed.data.salePrice,
        })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: { ok: true } })
}
