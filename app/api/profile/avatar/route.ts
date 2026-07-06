import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  removeProfileAvatar,
  updateProfileAvatarFocal,
  uploadProcessedProfileAvatar,
} from "@/lib/services/profileAvatar"
import {
  PROFILE_AVATAR_MAX_INPUT_BYTES,
  profileAvatarFocalSchema,
} from "@/lib/validations/profileAvatar"

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
    if (uploadFile.size > PROFILE_AVATAR_MAX_INPUT_BYTES) {
      return NextResponse.json(
        {
          error: `Image must be under ${Math.round(PROFILE_AVATAR_MAX_INPUT_BYTES / (1024 * 1024))}MB`,
        },
        { status: 400 },
      )
    }

    const { avatarUrl, focalX, focalY } = await uploadProcessedProfileAvatar({
      supabase,
      userId: user.id,
      file: uploadFile,
    })

    return NextResponse.json({ data: { avatarUrl, focalX, focalY } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/avatar]", message)
    return NextResponse.json({ error: "Failed to process or upload photo" }, { status: 500 })
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
    const parsed = profileAvatarFocalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid focal point" }, { status: 400 })
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profileRow?.avatar_url?.trim()) {
      return NextResponse.json({ error: "No profile photo to edit" }, { status: 400 })
    }

    const { focalX, focalY } = await updateProfileAvatarFocal({
      supabase,
      userId: user.id,
      focal: { x: parsed.data.focalX, y: parsed.data.focalY },
    })

    return NextResponse.json({ data: { focalX, focalY } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/avatar] PATCH", message)
    return NextResponse.json({ error: "Failed to update profile photo crop" }, { status: 500 })
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

    await removeProfileAvatar({ supabase, userId: user.id })

    return NextResponse.json({ data: { removed: true } }, { status: 200 })
  } catch (err: unknown) {
    const message = errMessage(err)
    console.error("[profile/avatar] DELETE", message)
    return NextResponse.json({ error: "Failed to remove photo" }, { status: 500 })
  }
}
