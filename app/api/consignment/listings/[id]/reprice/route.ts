import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { repriceConsignmentListing } from "@/lib/services/repriceConsignmentListing"

const bodySchema = z.object({ price: z.coerce.number().finite().positive() })
const paramsSchema = z.object({ id: z.string().uuid() })

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
    return NextResponse.json({ error: "Enter a valid price" }, { status: 400 })
  }

  const result = await repriceConsignmentListing({
    staffProfileId: user.id,
    listingId: parsedParams.data.id,
    price: parsed.data.price,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: { price: result.price } })
}
