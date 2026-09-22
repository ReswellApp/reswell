import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import {
  removeProfileTileBanner,
  updateProfileTileBannerFocal,
  uploadProcessedProfileTileBanner,
} from "@/lib/services/profileTileBanner"
import { PROFILE_BANNER_MAX_INPUT_BYTES, profileBannerFocalSchema } from "@/lib/validations/profileBanner"

export const maxDuration = 60
export const runtime = "nodejs"

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed"
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    const parsed = z.instanceof(File).safeParse(file)
    if (!parsed.success || !parsed.data || parsed.data.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const uploadFile = parsed.data
    if (uploadFile.size > PROFILE_BANNER_MAX_INPUT_BYTES) {
      return NextResponse.json(
        {
          error: `Image must be under ${Math.round(PROFILE_BANNER_MAX_INPUT_BYTES / (1024 * 1024))}MB`,
        },
        { status: 400 },
      )
    }

    const { bannerUrl, focalX, focalY } = await uploadProcessedProfileTileBanner({
      supabase,
      userId: user.id,
      file: uploadFile,
    })

    return NextResponse.json({ data: { bannerUrl, focalX, focalY } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/tile-banner]", message)
    return NextResponse.json({ error: "Failed to process or upload tile banner" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body: unknown = await request.json()
    const parsed = profileBannerFocalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid focal point" }, { status: 400 })
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("shop_tile_banner_url")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profileRow?.shop_tile_banner_url?.trim()) {
      return NextResponse.json({ error: "No tile banner to edit" }, { status: 400 })
    }

    const { focalX, focalY } = await updateProfileTileBannerFocal({
      supabase,
      userId: user.id,
      focal: { x: parsed.data.focalX, y: parsed.data.focalY },
    })

    return NextResponse.json({ data: { focalX, focalY } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/tile-banner] PATCH", message)
    return NextResponse.json({ error: "Failed to update tile banner crop" }, { status: 500 })
  }
}

export async function DELETE() {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await removeProfileTileBanner({ supabase, userId: user.id })
    return NextResponse.json({ data: { removed: true } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/tile-banner] DELETE", message)
    return NextResponse.json({ error: "Failed to remove tile banner" }, { status: 500 })
  }
}
