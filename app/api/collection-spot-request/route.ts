import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const MAX_MESSAGE = 5000
const MAX_SOCIAL = 500

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Sign in to request a spot" }, { status: 401 })
    }

    const body = await request.json()
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const socialRaw = typeof body.social_link === "string" ? body.social_link.trim() : ""
    const social_link = socialRaw.length > 0 ? socialRaw.slice(0, MAX_SOCIAL) : null

    if (!message) {
      return NextResponse.json({ error: "Tell us about your collection" }, { status: 400 })
    }

    if (message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: "Message is too long" }, { status: 400 })
    }

    const { error } = await supabase.from("collection_spot_requests").insert({
      user_id: user.id,
      message,
      social_link,
    })

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "You already have a pending request. We’ll review it soon." },
          { status: 409 },
        )
      }
      console.error("collection_spot_requests insert:", error)
      return NextResponse.json({ error: "Could not submit request" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Could not submit request" }, { status: 500 })
  }
}
