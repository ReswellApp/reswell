import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { removeProfileBanner, uploadProcessedProfileBanner } from "@/lib/services/profileBanner"
import { PROFILE_BANNER_MAX_INPUT_BYTES } from "@/lib/validations/profileBanner"

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

    const { bannerUrl } = await uploadProcessedProfileBanner({
      supabase,
      userId: user.id,
      file: uploadFile,
    })

    return NextResponse.json({ data: { bannerUrl } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/banner]", message)
    return NextResponse.json({ error: "Failed to process or upload banner" }, { status: 500 })
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
