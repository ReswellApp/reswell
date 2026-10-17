import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import {
  listListingPhotoToneRecipes,
  saveListingPhotoTones,
} from "@/lib/services/listingPhotoTone"
import { listingPhotoToneSaveSchema } from "@/lib/validations/listing-photo-tone"

export const maxDuration = 60

const listingIdParamSchema = z.string().uuid("Invalid listing id")

export async function GET(
  _request: NextRequest,
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

    const result = await listListingPhotoToneRecipes(supabase, {
      listingId: idParsed.data,
      actorUserId: user.id,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ data: { images: result.images } }, { status: 200 })
  } catch (error) {
    console.error(
      "[listings/photo-tone]",
      error instanceof Error ? error.message : "Request failed",
    )
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}

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

    const parsed = listingPhotoToneSaveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid photo adjustment", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const result = await saveListingPhotoTones(supabase, {
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
      "[listings/photo-tone]",
      error instanceof Error ? error.message : "Request failed",
    )
    return NextResponse.json({ error: "Request failed" }, { status: 500 })
  }
}
