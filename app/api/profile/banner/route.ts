import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  removeProfileBanner,
  updateProfileBannerFocal,
  uploadProcessedProfileBanner,
} from "@/lib/services/profileBanner"
import { PROFILE_BANNER_MAX_INPUT_BYTES, profileBannerFocalSchema } from "@/lib/validations/profileBanner"

export const maxDuration = 60
export const runtime = "nodejs"

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Request failed"
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    const { bannerUrl, focalX, focalY } = await uploadProcessedProfileBanner({
      supabase,
      userId: user.id,
      file: uploadFile,
    })

    return NextResponse.json({ data: { bannerUrl, focalX, focalY } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/banner]", message)
    return NextResponse.json({ error: "Failed to process or upload banner" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body: unknown = await request.json()
    const parsed = profileBannerFocalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid focal point" }, { status: 400 })
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("shop_banner_url")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profileRow?.shop_banner_url?.trim()) {
      return NextResponse.json({ error: "No banner to edit" }, { status: 400 })
    }

    const { focalX, focalY } = await updateProfileBannerFocal({
      supabase,
      userId: user.id,
      focal: { x: parsed.data.focalX, y: parsed.data.focalY },
    })

    return NextResponse.json({ data: { focalX, focalY } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/banner] PATCH", message)
    return NextResponse.json({ error: "Failed to update banner crop" }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await removeProfileBanner({ supabase, userId: user.id })

    return NextResponse.json({ data: { removed: true } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/banner] DELETE", message)
    return NextResponse.json({ error: "Failed to remove banner" }, { status: 500 })
  }
}
