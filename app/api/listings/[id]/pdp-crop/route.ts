import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { saveListingPdpCrops } from "@/lib/services/listingPdpCrop"
import { listingPdpCropSaveSchema } from "@/lib/validations/listing-pdp-crop"

const listingIdParamSchema = z.string().uuid("Invalid listing id")

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id: rawId } = await context.params
    const idParsed = listingIdParamSchema.safeParse(rawId)
    if (!idParsed.success) {
      return NextResponse.json({ error: "Invalid listing id" }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = listingPdpCropSaveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid crop", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const result = await saveListingPdpCrops(supabase, {
      listingId: idParsed.data,
      actorUserId: user.id,
      images: parsed.data.images,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ data: { images: result.images } }, { status: 200 })
  } catch (error) {
    console.error(
      "[listings/pdp-crop]",
      error instanceof Error ? error.message : "Request failed",
    )
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
