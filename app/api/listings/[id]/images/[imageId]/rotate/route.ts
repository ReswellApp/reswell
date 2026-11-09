import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { rotateListingImage } from "@/lib/services/listingImageRotate"
import { listingImageRotateSchema } from "@/lib/validations/listing-image-rotate"

const listingIdParamSchema = z.string().uuid("Invalid listing id")
const imageIdParamSchema = z.string().uuid("Invalid photo id")

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> },
) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id: rawId, imageId: rawImageId } = await context.params
    const idParsed = listingIdParamSchema.safeParse(rawId)
    const imageParsed = imageIdParamSchema.safeParse(rawImageId)
    if (!idParsed.success || !imageParsed.success) {
      return NextResponse.json({ error: "Invalid photo" }, { status: 400 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const parsed = listingImageRotateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Choose a 90° turn", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const result = await rotateListingImage(supabase, {
      listingId: idParsed.data,
      imageId: imageParsed.data,
      actorUserId: user.id,
      quarterTurns: parsed.data.quarterTurns,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ data: { image: result.image } }, { status: 200 })
  } catch (error) {
    console.error(
      "[listings/image-rotate]",
      error instanceof Error ? error.message : "Request failed",
    )
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
