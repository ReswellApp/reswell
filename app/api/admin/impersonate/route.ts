import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { IMPERSONATION_COOKIE } from "@/lib/impersonation"

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) return null
  return user
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { userId, displayName, email } = await request.json()
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 })
  }

  const cookieValue = JSON.stringify({ userId, displayName: displayName || "User", email: email || null })

  const res = NextResponse.json({ success: true, userId, displayName: displayName || "User", email: email || null })
  res.cookies.set(IMPERSONATION_COOKIE, cookieValue, {
    path: "/",
    maxAge: 60 * 60 * 4, // 4 hours
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return res
}

export async function DELETE() {
  const supabase = await createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(IMPERSONATION_COOKIE, "", {
    path: "/",
    maxAge: 0,
  })
  return res
}
