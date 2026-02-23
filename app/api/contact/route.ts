import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      )
    }

    if (message.length > 10000) {
      return NextResponse.json(
        { error: "Message is too long" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.from("contact_messages").insert({
      name,
      email,
      message,
    })

    if (error) {
      console.error("Contact form insert error:", error)
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}
